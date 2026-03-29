import { CollectivePosition } from '@partyjam/shared'

export function computeCollective(
  positions: { valence: number; energy: number }[]
): CollectivePosition {
  if (positions.length === 0) return { valence: 0, energy: 0 }
  const valence = positions.reduce((sum, p) => sum + p.valence, 0) / positions.length
  const energy = positions.reduce((sum, p) => sum + p.energy, 0) / positions.length
  return { valence, energy }
}
