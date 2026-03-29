import { describe, it, expect } from 'vitest'
import type { Track, QueueState } from './useRealtimeQueue'

// Pure merge function extracted for testing
function mergeTrack(prev: QueueState, updatedTrack: Track): QueueState {
  if (updatedTrack.status === 'playing') {
    return {
      nowPlaying: updatedTrack,
      queue: prev.queue.filter((t) => t.id !== updatedTrack.id),
    }
  }

  if (updatedTrack.status === 'played') {
    return {
      nowPlaying: prev.nowPlaying?.id === updatedTrack.id ? null : prev.nowPlaying,
      queue: prev.queue.filter((t) => t.id !== updatedTrack.id),
    }
  }

  const existingIndex = prev.queue.findIndex((t) => t.id === updatedTrack.id)
  let newQueue: Track[]

  if (existingIndex >= 0) {
    newQueue = [...prev.queue]
    newQueue[existingIndex] = updatedTrack
  } else {
    newQueue = [...prev.queue, updatedTrack]
  }

  newQueue.sort((a, b) => a.position - b.position)
  return { nowPlaying: prev.nowPlaying, queue: newQueue }
}

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: 'track-1',
  title: 'Test Track',
  artist: 'Test Artist',
  cover_url: null,
  duration: 180,
  status: 'queued',
  position: 1,
  added_by: 'guest-uuid',
  added_by_display: '🎵 Invite',
  file_path: null,
  ...overrides,
})

const emptyState: QueueState = { nowPlaying: null, queue: [] }

describe('useRealtimeQueue merge logic', () => {
  it('inserts new queued track and sorts by position', () => {
    const track1 = makeTrack({ id: 't1', position: 2 })
    const track2 = makeTrack({ id: 't2', position: 1 })

    const after1 = mergeTrack(emptyState, track1)
    expect(after1.queue).toHaveLength(1)

    const after2 = mergeTrack(after1, track2)
    expect(after2.queue).toHaveLength(2)
    expect(after2.queue[0].id).toBe('t2')
    expect(after2.queue[1].id).toBe('t1')
  })

  it('moves track to nowPlaying when status is playing', () => {
    const state: QueueState = {
      nowPlaying: null,
      queue: [makeTrack({ id: 't1', position: 2 }), makeTrack({ id: 't2', position: 1 })],
    }
    const playingTrack = makeTrack({ id: 't1', status: 'playing' })
    const result = mergeTrack(state, playingTrack)

    expect(result.nowPlaying?.id).toBe('t1')
    expect(result.queue).toHaveLength(1)
    expect(result.queue[0].id).toBe('t2')
  })

  it('removes track and clears nowPlaying when status is played', () => {
    const playingTrack = makeTrack({ id: 't1', status: 'playing' })
    const state: QueueState = {
      nowPlaying: playingTrack,
      queue: [makeTrack({ id: 't2', position: 1 })],
    }
    const playedTrack = makeTrack({ id: 't1', status: 'played' })
    const result = mergeTrack(state, playedTrack)

    expect(result.nowPlaying).toBeNull()
    expect(result.queue).toHaveLength(1)
  })

  it('updates existing queued track in place without duplicates', () => {
    const state: QueueState = {
      nowPlaying: null,
      queue: [makeTrack({ id: 't2', position: 1 })],
    }
    const updated = makeTrack({ id: 't2', position: 1, cover_url: 'http://example.com/cover.jpg' })
    const result = mergeTrack(state, updated)

    expect(result.queue).toHaveLength(1)
    expect(result.queue[0].cover_url).toBe('http://example.com/cover.jpg')
  })

  it('does not clear nowPlaying when a different track is played', () => {
    const nowPlaying = makeTrack({ id: 't1', status: 'playing' })
    const state: QueueState = {
      nowPlaying,
      queue: [makeTrack({ id: 't2', position: 1 })],
    }
    const playedOther = makeTrack({ id: 't2', status: 'played' })
    const result = mergeTrack(state, playedOther)

    expect(result.nowPlaying?.id).toBe('t1')
    expect(result.queue).toHaveLength(0)
  })
})

export { mergeTrack }
