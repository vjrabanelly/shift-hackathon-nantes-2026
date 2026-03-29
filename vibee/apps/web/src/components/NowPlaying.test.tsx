import { render, screen, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NowPlaying } from './NowPlaying'

const makeTrack = (overrides = {}) => ({
  id: 'track-1',
  title: 'Test Song',
  artist: 'Test Artist',
  cover_url: null,
  duration: 180,
  elapsed_seconds: 30,
  ...overrides,
})

describe('NowPlaying', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows "Nothing playing yet" when nowPlaying is null', () => {
    render(<NowPlaying nowPlaying={null} />)
    expect(screen.getByText('Nothing playing yet')).toBeInTheDocument()
  })

  it('displays title and artist', () => {
    render(<NowPlaying nowPlaying={makeTrack()} />)
    expect(screen.getByText('Test Song')).toBeInTheDocument()
    expect(screen.getByText('Test Artist')).toBeInTheDocument()
  })

  it('shows cover art image when cover_url is provided', () => {
    render(<NowPlaying nowPlaying={makeTrack({ cover_url: 'https://example.com/cover.jpg' })} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg')
  })

  it('shows placeholder when cover_url is null', () => {
    render(<NowPlaying nowPlaying={makeTrack({ cover_url: null })} />)
    expect(screen.queryByRole('img')).toBeNull()
    // Placeholder emoji present
    const placeholders = screen.getAllByText('🎵')
    expect(placeholders.length).toBeGreaterThan(0)
  })

  it('shows --:-- for duration when duration is null', () => {
    render(<NowPlaying nowPlaying={makeTrack({ duration: null })} />)
    expect(screen.getByText('--:--')).toBeInTheDocument()
  })

  it('progress bar ticks every second', () => {
    render(<NowPlaying nowPlaying={makeTrack({ elapsed_seconds: 0, duration: 60 })} />)
    expect(screen.getByText('0:00')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByText('0:03')).toBeInTheDocument()
  })
})
