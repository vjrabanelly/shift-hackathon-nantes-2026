import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { eventsRoutes } from '../events'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

vi.mock('../../lib/compute-collective', () => ({
  computeCollective: vi.fn().mockResolvedValue({ valence: 0.5, energy: 0.5 }),
}))

vi.mock('../../services/stream-manager', () => ({
  StreamManager: {
    getInstance: vi.fn().mockReturnValue({
      advanceToNextTrack: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

vi.mock('../../services/queue-engine', () => ({
  QueueEngine: {
    getInstance: vi.fn().mockReturnValue({
      reorder: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

import { supabase } from '../../lib/supabase'

const mockFrom = supabase.from as ReturnType<typeof vi.fn>

function buildApp() {
  const app = Fastify()
  app.register(eventsRoutes, { prefix: '/events' })
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /events/:id/skip', () => {
  it('returns 404 when event not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/events/evt-404/skip',
      headers: { 'x-admin-token': 'tok_abc' },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ error: 'Event not found' })
  })

  it('returns 403 when admin token is wrong', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'evt-1', admin_token: 'tok_correct' },
        error: null,
      }),
    })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/events/evt-1/skip',
      headers: { 'x-admin-token': 'tok_wrong' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: 'Invalid admin token' })
  })

  it('returns 200 with now_playing null when no next track', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // event lookup
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'evt-1', admin_token: 'tok_abc' },
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
      // now_playing lookup after advance
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/events/evt-1/skip',
      headers: { 'x-admin-token': 'tok_abc' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ now_playing: null })
  })

  it('returns 200 with now_playing track when next track exists', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // event lookup
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'evt-1', admin_token: 'tok_abc' },
            error: null,
          }),
        }
      }
      if (callCount === 2) {
        // playing track lookup
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'track-old' },
            error: null,
          }),
        }
      }
      if (callCount === 3) {
        // update old track to 'played'
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        }
      }
      // now_playing lookup after advance
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'track-new',
            title: 'Get Lucky',
            artist: 'Daft Punk',
            cover_url: 'https://example.com/cover.jpg',
            youtube_id: 'abc123',
          },
          error: null,
        }),
      }
    })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/events/evt-1/skip',
      headers: { 'x-admin-token': 'tok_abc' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      now_playing: {
        id: 'track-new',
        title: 'Get Lucky',
        artist: 'Daft Punk',
        cover_url: 'https://example.com/cover.jpg',
        youtube_id: 'abc123',
      },
    })
  })
})
