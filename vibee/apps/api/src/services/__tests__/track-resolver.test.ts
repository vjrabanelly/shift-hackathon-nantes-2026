import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

vi.mock('../../lib/ytdlp', () => ({
  downloadYouTube: vi.fn(),
}))

vi.mock('../essentia-client', () => ({
  essentiaClient: {
    analyze: vi.fn(),
  },
}))

vi.mock('../queue-engine', () => ({
  QueueEngine: {
    getInstance: vi.fn(() => ({
      reorder: vi.fn(),
    })),
  },
}))

vi.mock('@partyjam/connectors', () => {
  const mockResolve = vi.fn()
  return {
    YouTubeConnector: vi.fn(() => ({ resolve: mockResolve })),
    MusicBrainzMetadataConnector: vi.fn(() => ({ resolve: vi.fn() })),
    LastFmConnector: vi.fn(() => ({ resolve: vi.fn() })),
    MusicBrainzCoverArtConnector: vi.fn(() => ({ resolve: vi.fn() })),
    ItunesCoverArtConnector: vi.fn(() => ({ resolve: vi.fn() })),
    YouTubeThumbnailConnector: vi.fn(() => ({ resolve: vi.fn() })),
  }
})

import { supabase } from '../../lib/supabase'
import { downloadYouTube } from '../../lib/ytdlp'
import { essentiaClient } from '../essentia-client'
import { QueueEngine } from '../queue-engine'
import { TrackResolver, resolveCoverArt } from '../track-resolver'
import {
  YouTubeConnector,
  MusicBrainzMetadataConnector,
  LastFmConnector,
  MusicBrainzCoverArtConnector,
  ItunesCoverArtConnector,
  YouTubeThumbnailConnector,
} from '@partyjam/connectors'

function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'track-123' }, error: null }),
    eq: vi.fn().mockReturnThis(),
    ...overrides,
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TrackResolver.resolve', () => {
  it('marks request as failed when no connector resolves', async () => {
    // All connectors return null
    const ytConnector = new (YouTubeConnector as any)()
    const mbConnector = new (MusicBrainzMetadataConnector as any)()
    const lfConnector = new (LastFmConnector as any)()
    ytConnector.resolve.mockResolvedValue(null)
    mbConnector.resolve.mockResolvedValue(null)
    lfConnector.resolve.mockResolvedValue(null)

    const mockChain = makeSupabaseMock()
    vi.mocked(supabase.from).mockReturnValue(mockChain as any)

    await TrackResolver.resolve('unknown track', 'event-1', 'guest-1', 'req-1')

    expect(supabase.from).toHaveBeenCalledWith('requests')
    expect(mockChain.update).toHaveBeenCalledWith({ status: 'failed' })
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'req-1')
  })

  it('inserts track optimistically and updates request to resolved', async () => {
    const ytConnector = new (YouTubeConnector as any)()
    ytConnector.resolve.mockResolvedValue({
      title: 'Test Song',
      artist: 'Test Artist',
      youtube_id: 'abc123',
    })

    vi.mocked(downloadYouTube).mockResolvedValue('/tmp/abc123.mp3')
    vi.mocked(essentiaClient.analyze).mockResolvedValue({ duration: 180, bpm: 120 } as any)
    vi.mocked(QueueEngine.getInstance().reorder).mockResolvedValue(undefined)

    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'track-123' }, error: null }),
    }
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'tracks') return { ...insertChain, ...updateChain } as any
      return updateChain as any
    })

    await TrackResolver.resolve('Test Song Test Artist', 'event-1', 'guest-1', 'req-1')

    // Should insert track
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Song',
        artist: 'Test Artist',
        youtube_id: 'abc123',
        status: 'queued',
      })
    )

    // Should update request to resolved
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'resolved', resolved_track_id: 'track-123' })
    )
  })

  it('handles download failure gracefully (track still inserted)', async () => {
    const ytConnector = new (YouTubeConnector as any)()
    ytConnector.resolve.mockResolvedValue({
      title: 'Song',
      artist: 'Artist',
      youtube_id: 'yt999',
    })

    vi.mocked(downloadYouTube).mockRejectedValue(new Error('network error'))
    vi.mocked(QueueEngine.getInstance().reorder).mockResolvedValue(undefined)

    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'track-456' }, error: null }),
    }
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    vi.mocked(supabase.from).mockImplementation(() => ({ ...insertChain, ...updateChain } as any))

    await TrackResolver.resolve('Song Artist', 'event-1', 'guest-1', 'req-2')

    // Track should still be inserted
    expect(insertChain.insert).toHaveBeenCalled()

    // Request should be resolved (not failed), despite download error
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'resolved' })
    )
  })
})

describe('resolveCoverArt', () => {
  it('returns first successful URL from waterfall', async () => {
    const mbConnector = new (MusicBrainzCoverArtConnector as any)()
    const itunesConnector = new (ItunesCoverArtConnector as any)()
    const ytConnector = new (YouTubeThumbnailConnector as any)()

    mbConnector.resolve.mockRejectedValue(new Error('not found'))
    itunesConnector.resolve.mockResolvedValue('https://itunes.apple.com/cover.jpg')
    ytConnector.resolve.mockResolvedValue('https://img.youtube.com/thumbnail.jpg')

    const track = { title: 'Song', artist: 'Artist', youtube_id: 'yt123' }
    const result = await resolveCoverArt(track as any)

    expect(result).toBe('https://itunes.apple.com/cover.jpg')
    // Should not call YouTube connector since iTunes succeeded
    expect(ytConnector.resolve).not.toHaveBeenCalled()
  })

  it('returns null when all cover art connectors fail', async () => {
    const mbConnector = new (MusicBrainzCoverArtConnector as any)()
    const itunesConnector = new (ItunesCoverArtConnector as any)()
    const ytConnector = new (YouTubeThumbnailConnector as any)()

    mbConnector.resolve.mockResolvedValue(null)
    itunesConnector.resolve.mockResolvedValue(null)
    ytConnector.resolve.mockResolvedValue(null)

    const track = { title: 'Song', artist: 'Artist', youtube_id: null }
    const result = await resolveCoverArt(track as any)

    expect(result).toBeNull()
  })
})
