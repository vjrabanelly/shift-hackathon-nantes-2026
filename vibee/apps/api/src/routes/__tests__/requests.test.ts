import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { requestsRoutes } from '../requests'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

vi.mock('../../services/track-resolver', () => ({
  TrackResolver: {
    resolve: vi.fn().mockResolvedValue(undefined),
  },
}))

import { supabase } from '../../lib/supabase'
import { TrackResolver } from '../../services/track-resolver'

const mockFrom = supabase.from as ReturnType<typeof vi.fn>

function buildApp() {
  const app = Fastify()
  app.register(requestsRoutes, { prefix: '/events' })
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /events/:id/requests', () => {
  it('returns 400 when raw_text is empty', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/events/evt-1/requests',
      payload: { guest_id: 'g-1', raw_text: '   ' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'raw_text is required' })
  })

  it('returns 404 when event not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/events/evt-404/requests',
      payload: { guest_id: 'g-1', raw_text: 'Daft Punk' },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ error: 'Event not found' })
  })

  it('returns 202 and fires TrackResolver async', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // event lookup
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'evt-1' }, error: null }),
        }
      }
      // request insert
      return {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'req-1' },
          error: null,
        }),
      }
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/events/evt-1/requests',
      payload: { guest_id: 'g-1', raw_text: 'Daft Punk Around the World' },
    })
    expect(res.statusCode).toBe(202)
    expect(res.json()).toEqual({ request_id: 'req-1', status: 'pending' })

    // Give fire-and-forget a tick
    await new Promise((r) => setTimeout(r, 10))
    expect(TrackResolver.resolve).toHaveBeenCalledWith(
      'Daft Punk Around the World',
      'evt-1',
      'g-1',
      'req-1'
    )
  })

  it('returns 500 when insert fails', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'evt-1' }, error: null }),
        }
      }
      return {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('db error') }),
      }
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/events/evt-1/requests',
      payload: { guest_id: 'g-1', raw_text: 'Daft Punk' },
    })
    expect(res.statusCode).toBe(500)
  })
})
