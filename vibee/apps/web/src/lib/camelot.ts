const KEY_TO_CAMELOT: Record<string, string> = {
  'A minor': '1A',  'E minor': '2A',  'B minor': '3A',
  'F# minor': '4A', 'Gb minor': '4A', 'C# minor': '5A',
  'Db minor': '5A', 'G# minor': '6A', 'Ab minor': '6A',
  'D# minor': '7A', 'Eb minor': '7A', 'A# minor': '8A',
  'Bb minor': '8A', 'F minor': '9A',  'C minor': '10A',
  'G minor': '11A', 'D minor': '12A',
  'C major': '1B',  'G major': '2B',  'D major': '3B',
  'A major': '4B',  'E major': '5B',  'B major': '6B',
  'F# major': '7B', 'Gb major': '7B', 'C# major': '8B',
  'Db major': '8B', 'G# major': '9B', 'Ab major': '9B',
  'D# major': '10B','Eb major': '10B','A# major': '11B',
  'Bb major': '11B','F major': '12B',
}

export function toCamelotCode(key: string | null | undefined): string | null {
  if (!key) return null
  return KEY_TO_CAMELOT[key] ?? null
}
