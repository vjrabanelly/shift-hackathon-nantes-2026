import { describe, it, expect } from 'vitest'
import { computeCollective } from '../compute-collective'

describe('computeCollective', () => {
  it('returns neutral position for empty array', () => {
    expect(computeCollective([])).toEqual({ valence: 0, energy: 0 })
  })

  it('returns single position unchanged', () => {
    expect(computeCollective([{ valence: 0.5, energy: -0.3 }])).toEqual({ valence: 0.5, energy: -0.3 })
  })

  it('computes arithmetic mean of two positions', () => {
    const result = computeCollective([
      { valence: 0.8, energy: 0.6 },
      { valence: 0.4, energy: 0.2 },
    ])
    expect(result.valence).toBeCloseTo(0.6)
    expect(result.energy).toBeCloseTo(0.4)
  })

  it('handles negative values correctly', () => {
    const result = computeCollective([
      { valence: -1, energy: -0.5 },
      { valence: 1, energy: 0.5 },
    ])
    expect(result.valence).toBeCloseTo(0)
    expect(result.energy).toBeCloseTo(0)
  })

  it('averages multiple positions', () => {
    const result = computeCollective([
      { valence: 0, energy: 0 },
      { valence: 0.6, energy: 0.9 },
      { valence: 0.3, energy: 0.3 },
    ])
    expect(result.valence).toBeCloseTo(0.3)
    expect(result.energy).toBeCloseTo(0.4)
  })
})
