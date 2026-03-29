import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { tracksRoutes } from '../tracks'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '../../lib/supabase'

const mockFrom = supabase.from as ReturnType<typeof vi.fn>

function buildApp() {
  const app = Fastify()
  app.register(tracksRoutes, { prefix: '/events' })
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DELETE /events/:id/tracks/:trackId', () => {
  it('returns 404 when event not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'DELETE',
      url: '/events/evt-404/tracks/trk-1',
      headers: { 'x-admin-token': 'token' },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ error: 'Event not found' })
  })

  it('returns 403 when admin token is wrong', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { admin_token: 'correct' }, error: null }),
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'DELETE',
      url: '/events/evt-1/tracks/trk-1',
      headers: { 'x-admin-token': 'wrong' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: 'Invalid admin token' })
  })

  it('returns 204 on successful delete', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { admin_token: 'secret' }, error: null }),
        }
      }
      return {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        mockResolvedValue: vi.fn(),
        then: (fn: (value: { error: null }) => unknown) => Promise.resolve({ error: null }).then(fn),
      }
    })

    // Simpler approach: mock the chain properly
    mockFrom.mockReset()
    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { admin_token: 'secret' }, error: null }),
    }))
    mockFrom.mockImplementationOnce(() => {
      const chain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      }
      // The last .eq() call returns the promise result
      let eqCallCount = 0
      chain.eq.mockImplementation(() => {
        eqCallCount++
        if (eqCallCount >= 2) {
          return Promise.resolve({ error: null })
        }
        return chain
      })
      return chain
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'DELETE',
      url: '/events/evt-1/tracks/trk-1',
      headers: { 'x-admin-token': 'secret' },
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 403 when no admin token provided', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { admin_token: 'secret' }, error: null }),
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'DELETE',
      url: '/events/evt-1/tracks/trk-1',
    })
    expect(res.statusCode).toBe(403)
  })
})
