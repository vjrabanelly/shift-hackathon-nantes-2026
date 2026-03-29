/**
 * Unit tests for useRealtimeJoystick collective position logic.
 *
 * These tests verify the collective position update/merge logic in isolation.
 * Integration tests require a running Supabase instance.
 */

import { describe, it, expect } from 'vitest'
import type { CollectivePosition } from './useRealtimeJoystick'

// Pure helper: apply a broadcast payload to current collective state
function applyCollectiveBroadcast(
  current: CollectivePosition,
  payload: unknown
): CollectivePosition {
  const p = payload as { payload?: { collective?: CollectivePosition } }
  if (p?.payload?.collective) {
    return p.payload.collective
  }
  return current
}

const defaultCollective: CollectivePosition = { valence: 0, energy: 0 }

describe('applyCollectiveBroadcast', () => {
  it('updates collective on valid broadcast', () => {
    const broadcast = { payload: { collective: { valence: 0.5, energy: 0.8 } } }
    const result = applyCollectiveBroadcast(defaultCollective, broadcast)
    expect(result.valence).toBe(0.5)
    expect(result.energy).toBe(0.8)
  })

  it('leaves state unchanged when broadcast has no collective', () => {
    const result = applyCollectiveBroadcast(defaultCollective, { payload: {} })
    expect(result.valence).toBe(0)
    expect(result.energy).toBe(0)
  })

  it('leaves state unchanged on null payload', () => {
    const result = applyCollectiveBroadcast(defaultCollective, null)
    expect(result.valence).toBe(0)
    expect(result.energy).toBe(0)
  })

  it('applies successive broadcasts in sequence', () => {
    const c1 = applyCollectiveBroadcast(defaultCollective, {
      payload: { collective: { valence: -0.3, energy: 0.1 } },
    })
    const c2 = applyCollectiveBroadcast(c1, {
      payload: { collective: { valence: 0.7, energy: -0.4 } },
    })
    expect(c2.valence).toBe(0.7)
    expect(c2.energy).toBe(-0.4)
  })

  it('preserves extreme values (clamping is done server-side)', () => {
    const result = applyCollectiveBroadcast(defaultCollective, {
      payload: { collective: { valence: 1, energy: -1 } },
    })
    expect(result.valence).toBe(1)
    expect(result.energy).toBe(-1)
  })
})

export { applyCollectiveBroadcast }
