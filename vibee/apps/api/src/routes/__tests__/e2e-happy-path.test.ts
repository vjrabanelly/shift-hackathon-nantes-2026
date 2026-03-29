/**
 * Story 9.1 — End-to-End Integration Test (Happy Path)
 *
 * Covers: create event → join as guest → request track → joystick → admin skip
 *
 * Uses Fastify inject so no live server or Supabase is required.
 * External dependencies (supabase, TrackResolver, StreamManager, QueueEngine)
 * are mocked so the test is deterministic and fast.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { eventsRoutes } from '../events'
import { guestsRoutes } from '../guests'
import { requestsRoutes } from '../requests'
import { joystickRoutes } from '../joystick'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn().mockReturnValue({
      send: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

vi.mock('../../lib/compute-collective', () => ({
  computeCollective: vi.fn().mockReturnValue({ valence: 0.7, energy: 0.8 }),
}))

vi.mock('../../services/stream-manager', () => ({
  StreamManager: {
    getInstance: vi.fn().mockReturnValue({
      init: vi.fn(),
      advanceToNextTrack: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

vi.mock('../../services/queue-engine', () => ({
  QueueEngine: {
    getInstance: vi.fn().mockReturnValue({
      start: vi.fn(),
      reorder: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

vi.mock('../../services/track-resolver', () => ({
  TrackResolver: {
    resolve: vi.fn().mockResolvedValue(undefined),
  },
}))

import { supabase } from '../../lib/supabase'

const mockFrom = supabase.from as ReturnType<typeof vi.fn>

// ── Test State ────────────────────────────────────────────────────────────────

const EVENT_ID = 'evt-e2e-001'
const ADMIN_TOKEN = 'tok_abc123def456'
const GUEST_ID = 'guest-001'
const REQUEST_ID = 'req-001'

// ── App Factory ───────────────────────────────────────────────────────────────

function buildApp() {
  const app = Fastify({ logger: false })
  app.register(eventsRoutes, { prefix: '/events' })
  app.register(guestsRoutes, { prefix: '/events' })
  app.register(requestsRoutes, { prefix: '/events' })
  app.register(joystickRoutes, { prefix: '/events' })
  app.get('/health', async () => ({ status: 'ok' }))
  return app
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Story 9.1 — E2E Happy Path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Step 1: POST /events — creates event and returns event_id + admin_token', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: EVENT_ID, name: 'E2E Party', admin_token: ADMIN_TOKEN },
        error: null,
      }),
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/events',
      payload: { name: 'E2E Party', seed_playlist: [] },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.event_id).toBe(EVENT_ID)
    expect(body.admin_token).toMatch(/^tok_/)
    expect(body.join_url).toContain(EVENT_ID)
    expect(body.qr_url).toBeTruthy()
  })

  it('Step 2: GET /events/:id — returns event state', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // event select
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: EVENT_ID, name: 'E2E Party', admin_token: ADMIN_TOKEN },
            error: null,
          }),
        }
      }
      if (callCount === 2) {
        // playing track
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      if (callCount === 3) {
        // queued tracks
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      if (callCount === 4) {
        // guests
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      if (callCount === 5) {
        // guest count
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
        }
      }
      // joystick positions
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    })

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: `/events/${EVENT_ID}` })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.event.id).toBe(EVENT_ID)
    expect(body.queue).toEqual([])
    expect(body.now_playing).toBeNull()
    expect(body).toHaveProperty('collective_joystick')
  })

  it('Step 3: POST /events/:id/join — guest joins and receives guest_id + emoji', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // event exists check
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: EVENT_ID },
            error: null,
          }),
        }
      }
      // guest insert
      return {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: GUEST_ID,
            event_id: EVENT_ID,
            display_name: 'TestGuest',
            emoji: '🎵',
          },
          error: null,
        }),
      }
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `/events/${EVENT_ID}/join`,
      payload: { display_name: 'TestGuest' },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.guest_id).toBe(GUEST_ID)
    expect(body.emoji).toBeTruthy()
    expect(body.display_name).toBe('TestGuest')
  })

  it('Step 4: POST /events/:id/requests — guest submits a music request', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // event exists check
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: EVENT_ID }, error: null }),
        }
      }
      // request insert
      return {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: REQUEST_ID, event_id: EVENT_ID, status: 'pending' },
          error: null,
        }),
      }
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `/events/${EVENT_ID}/requests`,
      payload: { guest_id: GUEST_ID, raw_text: 'Daft Punk Around the World' },
    })

    expect(res.statusCode).toBe(202)
    const body = res.json()
    expect(body.request_id).toBe(REQUEST_ID)
    expect(body.status).toBe('pending')
  })

  it('Step 5: PATCH /events/:id/joystick — updates position and returns collective', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // upsert joystick position
        return { upsert: vi.fn().mockResolvedValue({ error: null }) }
      }
      // select positions for collective computation
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [{ valence: 0.7, energy: 0.8 }], error: null }),
      }
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: `/events/${EVENT_ID}/joystick`,
      payload: { guest_id: GUEST_ID, valence: 0.7, energy: 0.8 },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.collective).toBeDefined()
    expect(typeof body.collective.valence).toBe('number')
    expect(typeof body.collective.energy).toBe('number')
  })

  it('Step 6: POST /events/:id/skip (admin) — skips current track', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // event + admin_token check
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: EVENT_ID, admin_token: ADMIN_TOKEN },
            error: null,
          }),
        }
      }
      if (callCount === 2) {
        // playing track lookup
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      // now_playing after advance
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `/events/${EVENT_ID}/skip`,
      headers: { 'x-admin-token': ADMIN_TOKEN },
    })

    expect(res.statusCode).toBe(200)
  })

  it('Step 6b: POST /events/:id/skip — rejects wrong admin token', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: EVENT_ID, admin_token: ADMIN_TOKEN },
        error: null,
      }),
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `/events/${EVENT_ID}/skip`,
      headers: { 'x-admin-token': 'wrong_token' },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: 'Invalid admin token' })
  })

  it('Health check — GET /health returns ok', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })
})
