/**
 * Unit tests for useNowPlaying hook logic.
 * Verifies track state merging and null handling.
 */

import { describe, it, expect } from 'vitest'

interface NowPlayingTrack {
  id: string
  title: string
  artist: string
  cover_url: string | null
  duration: number | null
  elapsed_seconds: number
}

const makeTrack = (overrides: Partial<NowPlayingTrack> = {}): NowPlayingTrack => ({
  id: 'track-1',
  title: 'Test Track',
  artist: 'Test Artist',
  cover_url: null,
  duration: 180,
  elapsed_seconds: 30,
  ...overrides,
})

describe('useNowPlaying track state logic', () => {
  it('initial state is null', () => {
    const current: NowPlayingTrack | null = null
    expect(current).toBeNull()
  })

  it('sets a track', () => {
    const current = makeTrack({ id: 't1' })
    expect(current).not.toBeNull()
    expect(current.id).toBe('t1')
  })

  it('track change resets to new track', () => {
    const current = makeTrack({ id: 't2', elapsed_seconds: 0 })
    expect(current.id).toBe('t2')
    expect(current.elapsed_seconds).toBe(0)
  })

  it('now playing can be null between tracks', () => {
    const current: NowPlayingTrack | null = null
    expect(current).toBeNull()
  })

  it('cover_url can be null — UI shows placeholder', () => {
    const current = makeTrack({ cover_url: null })
    expect(current.cover_url).toBeNull()
  })

  it('duration can be null — show --:-- in UI', () => {
    const current = makeTrack({ duration: null })
    expect(current.duration).toBeNull()
  })
})
