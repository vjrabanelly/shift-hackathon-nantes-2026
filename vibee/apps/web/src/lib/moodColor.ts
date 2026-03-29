export type MoodZone = 'ambient' | 'festive' | 'chill' | 'intense'

export interface MoodConfig {
  genre: string
  label: string
  amplitude: number
  frequency: number
  sharpness: number
  speed: number
  baseColor: string
  energy: string
  crowd: string
}

export const MOOD_MAP: Record<MoodZone, MoodConfig> = {
  ambient: {
    genre: 'ambient / textured',
    label: 'ambiant',
    amplitude: 20,
    frequency: 0.08,
    sharpness: 1.2,
    speed: 0.07,
    baseColor: '#3FE08A',
    energy: 'floating movement',
    crowd: 'immersive drift',
  },
  festive: {
    genre: 'party / uplift',
    label: 'festif',
    amplitude: 28,
    frequency: 0.12,
    sharpness: 1.8,
    speed: 0.12,
    baseColor: '#FF5A5A',
    energy: 'social release',
    crowd: 'open smiles',
  },
  chill: {
    genre: 'chill / smooth',
    label: 'calme',
    amplitude: 18,
    frequency: 0.06,
    sharpness: 1.0,
    speed: 0.06,
    baseColor: '#5A9BFF',
    energy: 'soft momentum',
    crowd: 'gentle sway',
  },
  intense: {
    genre: 'peak / pressure',
    label: 'intense',
    amplitude: 42,
    frequency: 0.16,
    sharpness: 3.6,
    speed: 0.18,
    baseColor: '#FFD83D',
    energy: 'high pressure',
    crowd: 'locked focus',
  },
}

export const CORNER_COLORS = {
  ambient: [63, 224, 138],
  festive: [255, 90, 90],
  chill: [90, 155, 255],
  intense: [255, 216, 61],
} as const

const MOOD_ADJECTIVES: Record<MoodZone, string[]> = {
  ambient: ['planant', 'aérien', 'flottant', 'éthéré', 'brumeux', 'suspendu'],
  festive: ['euphorique', 'électrique', 'enflammé', 'exalté', 'débridé', 'solaire'],
  intense: ['pulsant', 'frénétique', 'brûlant', 'tendu', 'hypnotique', 'ravageur'],
  chill: ['cosy', 'feutré', 'doux', 'serein', 'enveloppant', 'apaisé'],
}

const refineMixedRgb = (rgb: number[]) =>
  rgb.map((channel) => {
    const centered = 128 + (channel - 128) * 1.08
    return Math.max(0, Math.min(255, Math.round(centered * 0.96 + 255 * 0.04)))
  })

export const mixCornerColor = (x: number, y: number) => {
  const weights = {
    ambient: (1 - x) * (1 - y),
    festive: x * (1 - y),
    chill: (1 - x) * y,
    intense: x * y,
  } as const

  const rawRgb = [0, 0, 0].map((_, channel) =>
    Math.round(
      CORNER_COLORS.ambient[channel] * weights.ambient +
        CORNER_COLORS.festive[channel] * weights.festive +
        CORNER_COLORS.chill[channel] * weights.chill +
        CORNER_COLORS.intense[channel] * weights.intense,
    ),
  )

  const sortedWeights = (Object.entries(weights) as Array<[MoodZone, number]>).sort(
    (a, b) => b[1] - a[1],
  )
  const dominant = sortedWeights[0][0]
  const secondary = sortedWeights[1][0]
  const isBlend = sortedWeights[0][1] < 0.52

  const clampIndex = (value: number) =>
    Math.max(0, Math.min(MOOD_ADJECTIVES.ambient.length - 1, Math.round(value)))

  const dominantIndex = clampIndex((x + y) * 2.5)
  const secondaryIndex = clampIndex(((1 - x) + (1 - y)) * 2.5)

  const dominantLabel = MOOD_ADJECTIVES[dominant][dominantIndex]
  const secondaryLabel = MOOD_ADJECTIVES[secondary][secondaryIndex]

  const label = isBlend ? `${dominantLabel} · ${secondaryLabel}` : dominantLabel

  return {
    rgb: refineMixedRgb(rawRgb),
    dominant,
    secondary,
    label,
    isBlend,
  }
}

export const rgbToCss = (rgb: number[], alpha = 1) =>
  `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
