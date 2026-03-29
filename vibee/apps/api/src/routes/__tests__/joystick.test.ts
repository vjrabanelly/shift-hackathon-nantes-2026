import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { joystickRoutes } from '../joystick'

const { mockUpsert, mockEq, mockSelect, mockChannelSend, mockChannel } = vi.hoisted(() => {
  const mockUpsert = vi.fn()
  const mockEq = vi.fn()
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockChannelSend = vi.fn().mockResolvedValue({ error: null })
  const mockChannel = vi.fn(() => ({ send: mockChannelSend }))
  return { mockUpsert, mockEq, mockSelect, mockChannelSend, mockChannel }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: mockUpsert,
      select: mockSelect,
    })),
    channel: mockChannel,
  },
}))

// Mock QueueEngine
vi.mock('../../services/queue-engine', () => ({
  QueueEngine: {
    getInstance: vi.fn().mockReturnValue({
      reorder: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

function buildApp() {
  const app = Fastify({ logger: false })
  app.register(joystickRoutes, { prefix: '/events' })
  return app
}

describe('PATCH /events/:id/joystick', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpsert.mockResolvedValue({ error: null })
    mockSelect.mockImplementation(() => ({ eq: mockEq }))
    mockEq.mockResolvedValue({ data: [{ valence: 0.7, energy: 0.8 }] })
    mockChannel.mockImplementation(() => ({ send: mockChannelSend }))
    mockChannelSend.mockResolvedValue({ error: null })
  })

  it('returns collective average on success', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/events/event-123/joystick',
      payload: { guest_id: 'guest-1', valence: 0.7, energy: 0.8 },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.collective).toEqual({ valence: 0.7, energy: 0.8 })
  })

  it('clamps valence and energy to [-1, 1]', async () => {
    mockEq.mockResolvedValue({
      data: [{ valence: 1.0, energy: -1.0 }],
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/events/event-123/joystick',
      payload: { guest_id: 'guest-1', valence: 1.5, energy: -2.0 },
    })

    expect(res.statusCode).toBe(200)
    // Verify upsert was called with clamped values
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ valence: 1.0, energy: -1.0 }),
      expect.any(Object)
    )
  })

  it('returns 400 if valence is not a number', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/events/event-123/joystick',
      payload: { guest_id: 'guest-1', valence: 'bad', energy: 0.5 },
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 if energy is not a number', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/events/event-123/joystick',
      payload: { guest_id: 'guest-1', valence: 0.5, energy: null },
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 500 if upsert fails', async () => {
    mockUpsert.mockResolvedValue({ error: new Error('DB error') })

    const app = buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/events/event-123/joystick',
      payload: { guest_id: 'guest-1', valence: 0.5, energy: 0.5 },
    })

    expect(res.statusCode).toBe(500)
  })

  it('computes collective average across multiple guests', async () => {
    mockEq.mockResolvedValue({
      data: [
        { valence: 0.6, energy: 0.4 },
        { valence: -0.2, energy: 0.8 },
      ],
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/events/event-123/joystick',
      payload: { guest_id: 'guest-2', valence: -0.2, energy: 0.8 },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.collective.valence).toBeCloseTo(0.2)
    expect(body.collective.energy).toBeCloseTo(0.6)
  })
})
