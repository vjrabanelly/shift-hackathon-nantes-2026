import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { QueueEngine } from '../queue-engine'

describe('QueueEngine', () => {
  describe('getInstance', () => {
    it('returns the same instance every time', () => {
      const a = QueueEngine.getInstance()
      const b = QueueEngine.getInstance()
      expect(a).toBe(b)
    })
  })

  describe('computeCollective', () => {
    const qe = QueueEngine.getInstance()

    it('returns {0,0} for empty array', () => {
      expect(qe.computeCollective([])).toEqual({ valence: 0, energy: 0 })
    })

    it('returns the single position unchanged', () => {
      expect(qe.computeCollective([{ valence: 0.5, energy: 0.8 }])).toEqual({
        valence: 0.5,
        energy: 0.8,
      })
    })

    it('averages multiple positions', () => {
      const result = qe.computeCollective([
        { valence: 0.5, energy: 0.3 },
        { valence: -0.5, energy: 0.7 },
      ])
      expect(result.valence).toBeCloseTo(0)
      expect(result.energy).toBeCloseTo(0.5)
    })

    it('handles three positions', () => {
      const result = qe.computeCollective([
        { valence: 0.6, energy: 0.2 },
        { valence: 0.9, energy: 0.8 },
        { valence: 0.3, energy: 0.5 },
      ])
      expect(result.valence).toBeCloseTo(0.6)
      expect(result.energy).toBeCloseTo(0.5)
    })

    it('handles negative valence values', () => {
      const result = qe.computeCollective([
        { valence: -0.5, energy: -0.3 },
        { valence: -0.1, energy: -0.7 },
      ])
      expect(result.valence).toBeCloseTo(-0.3)
      expect(result.energy).toBeCloseTo(-0.5)
    })
  })

  describe('reorder', () => {
    it('resolves without error when no candidates exist', async () => {
      const { supabase } = await import('../../lib/supabase')

      const makeChain = (resolveValue: unknown) => {
        const chain: Record<string, unknown> = {}
        const methods = ['select', 'eq', 'not', 'gte', 'order']
        for (const m of methods) {
          chain[m] = vi.fn().mockImplementation(() => {
            // Return a thenable for the last call, otherwise return chain
            const proxy = new Proxy(chain, {
              get(target, prop) {
                if (prop === 'then') {
                  return (resolve: (v: unknown) => void) => resolve(resolveValue)
                }
                return target[prop as string]
              },
            })
            return proxy
          })
        }
        return chain
      }

      ;(supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        makeChain({ data: [] })
      )

      const qe = QueueEngine.getInstance()
      await expect(qe.reorder('test-event-id')).resolves.toBeUndefined()
    })
  })
})
