import { describe, it, expect } from 'vitest';
import { computeDiversityIndex } from '../screens/screen-knowledge';

describe('computeDiversityIndex', () => {
  it('returns 0 for empty array', () => {
    expect(computeDiversityIndex([])).toBe(0);
  });

  it('returns 0 for single item', () => {
    expect(computeDiversityIndex([{ count: 100 }])).toBe(0);
  });

  it('returns 1 for perfectly even distribution', () => {
    const items = [{ count: 10 }, { count: 10 }, { count: 10 }, { count: 10 }];
    expect(computeDiversityIndex(items)).toBeCloseTo(1, 5);
  });

  it('returns close to 0 for highly skewed distribution', () => {
    const items = [{ count: 1000 }, { count: 1 }, { count: 1 }, { count: 1 }];
    const idx = computeDiversityIndex(items);
    expect(idx).toBeLessThan(0.1);
  });

  it('returns intermediate value for moderate skew', () => {
    const items = [{ count: 50 }, { count: 30 }, { count: 15 }, { count: 5 }];
    const idx = computeDiversityIndex(items);
    expect(idx).toBeGreaterThan(0.4);
    expect(idx).toBeLessThan(0.95);
  });

  it('returns 0 when all counts are zero', () => {
    expect(computeDiversityIndex([{ count: 0 }, { count: 0 }])).toBe(0);
  });

  it('handles two equal items (should be 1.0)', () => {
    const idx = computeDiversityIndex([{ count: 50 }, { count: 50 }]);
    expect(idx).toBeCloseTo(1, 5);
  });

  it('higher diversity for more even distributions', () => {
    const skewed = computeDiversityIndex([{ count: 80 }, { count: 10 }, { count: 5 }, { count: 5 }]);
    const even = computeDiversityIndex([{ count: 25 }, { count: 25 }, { count: 25 }, { count: 25 }]);
    expect(even).toBeGreaterThan(skewed);
  });
});
