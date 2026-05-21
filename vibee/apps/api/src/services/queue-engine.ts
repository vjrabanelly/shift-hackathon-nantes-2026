import { supabase } from '../lib/supabase'

interface TrackForQueue {
  id: string
  created_at: string
  position?: number
  essentia_features?: {
    bpm?: number
    key?: string
    energy?: number
    valence?: number
    mood?: string
  } | null
}

// Camelot wheel: 1-12, A = minor, B = major
const KEY_TO_CAMELOT: Record<string, { n: number; m: 'A' | 'B' }> = {
  'A minor':  { n: 1,  m: 'A' },
  'E minor':  { n: 2,  m: 'A' },
  'B minor':  { n: 3,  m: 'A' },
  'F# minor': { n: 4,  m: 'A' },
  'Gb minor': { n: 4,  m: 'A' },
  'C# minor': { n: 5,  m: 'A' },
  'Db minor': { n: 5,  m: 'A' },
  'G# minor': { n: 6,  m: 'A' },
  'Ab minor': { n: 6,  m: 'A' },
  'D# minor': { n: 7,  m: 'A' },
  'Eb minor': { n: 7,  m: 'A' },
  'A# minor': { n: 8,  m: 'A' },
  'Bb minor': { n: 8,  m: 'A' },
  'F minor':  { n: 9,  m: 'A' },
  'C minor':  { n: 10, m: 'A' },
  'G minor':  { n: 11, m: 'A' },
  'D minor':  { n: 12, m: 'A' },
  'C major':  { n: 1,  m: 'B' },
  'G major':  { n: 2,  m: 'B' },
  'D major':  { n: 3,  m: 'B' },
  'A major':  { n: 4,  m: 'B' },
  'E major':  { n: 5,  m: 'B' },
  'B major':  { n: 6,  m: 'B' },
  'F# major': { n: 7,  m: 'B' },
  'Gb major': { n: 7,  m: 'B' },
  'C# major': { n: 8,  m: 'B' },
  'Db major': { n: 8,  m: 'B' },
  'G# major': { n: 9,  m: 'B' },
  'Ab major': { n: 9,  m: 'B' },
  'D# major': { n: 10, m: 'B' },
  'Eb major': { n: 10, m: 'B' },
  'A# major': { n: 11, m: 'B' },
  'Bb major': { n: 11, m: 'B' },
  'F major':  { n: 12, m: 'B' },
}

function camelotDistance(keyA?: string | null, keyB?: string | null): number {
  if (!keyA || !keyB) return 3
  const a = KEY_TO_CAMELOT[keyA]
  const b = KEY_TO_CAMELOT[keyB]
  if (!a || !b) return 3
  if (a.n === b.n && a.m === b.m) return 0
  if (a.n === b.n) return 1  // relative major/minor
  const diff = Math.abs(a.n - b.n)
  const circular = Math.min(diff, 12 - diff)
  if (circular === 1 && a.m === b.m) return 1  // adjacent, same mode
  if (circular === 1) return 2                  // adjacent, different mode
  return 3
}

function bpmDistance(bpmA?: number | null, bpmB?: number | null): number {
  if (!bpmA || !bpmB) return 2
  const direct = Math.abs(bpmA - bpmB) / Math.max(bpmA, bpmB)
  if (direct <= 0.02) return 0
  if (direct <= 0.06) return 1
  const doubleDiff = Math.abs(bpmA * 2 - bpmB) / Math.max(bpmA * 2, bpmB)
  const halfDiff = Math.abs(bpmA - bpmB * 2) / Math.max(bpmA, bpmB * 2)
  if (Math.min(doubleDiff, halfDiff) <= 0.06) return 1
  if (direct <= 0.12) return 2
  return 3
}

// Key compatibility is weighted 2x over BPM proximity
function transitionScore(a: TrackForQueue, b: TrackForQueue): number {
  return camelotDistance(a.essentia_features?.key, b.essentia_features?.key) * 2
    + bpmDistance(a.essentia_features?.bpm, b.essentia_features?.bpm)
}

// Greedy nearest-neighbour chain starting from the anchor (now-playing track)
function buildCamelotOrderedQueue(
  tracks: TrackForQueue[],
  anchor: TrackForQueue | null,
): TrackForQueue[] {
  if (tracks.length <= 1) return tracks

  const remaining = [...tracks]
  const result: TrackForQueue[] = []
  let current: TrackForQueue | null = anchor

  while (remaining.length > 0) {
    let bestIndex = 0
    let bestScore = Infinity

    for (let i = 0; i < remaining.length; i++) {
      const score = current ? transitionScore(current, remaining[i]) : 0
      if (score < bestScore) {
        bestScore = score
        bestIndex = i
      }
    }

    result.push(remaining[bestIndex])
    current = remaining[bestIndex]
    remaining.splice(bestIndex, 1)
  }

  return result
}

export class QueueEngine {
  private static instance: QueueEngine | null = null

  static getInstance(): QueueEngine {
    if (!QueueEngine.instance) {
      QueueEngine.instance = new QueueEngine()
    }
    return QueueEngine.instance
  }

  start(): void {}

  // Full reorder using Camelot+BPM (preserves no existing order — use for admin actions)
  async reorder(eventId: string): Promise<void> {
    const { data: nowPlaying } = await supabase
      .from('tracks')
      .select('id, created_at, position, essentia_features')
      .eq('event_id', eventId)
      .eq('status', 'playing')
      .maybeSingle()

    const { data: tracks, error } = await supabase
      .from('tracks')
      .select('id, created_at, position, essentia_features')
      .eq('event_id', eventId)
      .eq('status', 'queued')
      .order('position', { ascending: true })

    if (error || !tracks) return

    const ordered = buildCamelotOrderedQueue(
      tracks as TrackForQueue[],
      (nowPlaying as TrackForQueue | null | undefined) ?? null,
    )

    await Promise.all(
      ordered.map((track, index) =>
        supabase.from('tracks').update({ position: index + 1 }).eq('id', track.id),
      ),
    )
  }

  // Insert a single new track at its harmonically optimal position without shuffling the rest
  async insertAtBestPosition(eventId: string, newTrackId: string): Promise<void> {
    const { data: newTrack } = await supabase
      .from('tracks')
      .select('id, created_at, essentia_features')
      .eq('id', newTrackId)
      .single()

    if (!newTrack) return

    const { data: existing } = await supabase
      .from('tracks')
      .select('id, created_at, position, essentia_features')
      .eq('event_id', eventId)
      .eq('status', 'queued')
      .neq('id', newTrackId)
      .order('position', { ascending: true })

    const queue = (existing ?? []) as TrackForQueue[]

    if (queue.length === 0) {
      await supabase.from('tracks').update({ position: 1 }).eq('id', newTrackId)
      return
    }

    const { data: anchor } = await supabase
      .from('tracks')
      .select('id, created_at, essentia_features')
      .eq('event_id', eventId)
      .eq('status', 'playing')
      .maybeSingle()

    let bestSlot = queue.length  // default: append at end
    let bestScore = Infinity

    for (let slot = 0; slot <= queue.length; slot++) {
      const prev = slot === 0
        ? ((anchor as TrackForQueue | null | undefined) ?? null)
        : queue[slot - 1]
      const next = slot < queue.length ? queue[slot] : null

      const scorePrev = prev ? transitionScore(prev, newTrack as TrackForQueue) : 0
      const scoreNext = next ? transitionScore(newTrack as TrackForQueue, next) : 0

      if (scorePrev + scoreNext < bestScore) {
        bestScore = scorePrev + scoreNext
        bestSlot = slot
      }
    }

    // Reassign positions keeping existing relative order, new track inserted at bestSlot
    const updates: Array<{ id: string; position: number }> = [
      ...queue.slice(0, bestSlot).map((t, i) => ({ id: t.id, position: i + 1 })),
      { id: newTrackId, position: bestSlot + 1 },
      ...queue.slice(bestSlot).map((t, i) => ({ id: t.id, position: bestSlot + 2 + i })),
    ]

    await Promise.all(
      updates.map(({ id, position }) =>
        supabase.from('tracks').update({ position }).eq('id', id),
      ),
    )
  }
}
