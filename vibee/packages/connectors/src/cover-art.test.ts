import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ItunesCoverArtConnector, YouTubeThumbnailConnector } from './cover-art'
import type { Track } from './types'

const track: Track = {
  title: 'Around the World',
  artist: 'Daft Punk',
  source: 'youtube',
}

const trackWithYouTube: Track = {
  ...track,
  youtube_id: 'K0HSD_i2DvA',
}

describe('YouTubeThumbnailConnector', () => {
  const connector = new YouTubeThumbnailConnector()

  it('returns thumbnail URL when youtube_id is set', async () => {
    const url = await connector.resolve(trackWithYouTube)
    expect(url).toBe('https://img.youtube.com/vi/K0HSD_i2DvA/mqdefault.jpg')
  })

  it('returns null when youtube_id is not set', async () => {
    const url = await connector.resolve(track)
    expect(url).toBeNull()
  })
})

describe('ItunesCoverArtConnector', () => {
  const connector = new ItunesCoverArtConnector()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns high-res artwork URL on success', async () => {
    const mockResponse = {
      results: [{ artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music/abc/100x100bb.jpg' }],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }))

    const url = await connector.resolve(track)
    expect(url).toBe('https://is1-ssl.mzstatic.com/image/thumb/Music/abc/600x600bb.jpg')
  })

  it('returns null when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const url = await connector.resolve(track)
    expect(url).toBeNull()
  })

  it('returns null when no results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    }))
    const url = await connector.resolve(track)
    expect(url).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const url = await connector.resolve(track)
    expect(url).toBeNull()
  })
})
