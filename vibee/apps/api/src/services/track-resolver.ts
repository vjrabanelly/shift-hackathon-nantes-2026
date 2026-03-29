import { supabase } from '../lib/supabase'
import { downloadYouTube } from '../lib/ytdlp'
import { essentiaClient } from './essentia-client'
import { QueueEngine } from './queue-engine'
import { StreamManager } from './stream-manager'
import { YouTubeConnector } from '@partyjam/connectors'
import { MusicBrainzMetadataConnector } from '@partyjam/connectors'
import { LastFmConnector } from '@partyjam/connectors'
import {
  MusicBrainzCoverArtConnector,
  ItunesCoverArtConnector,
  YouTubeThumbnailConnector,
} from '@partyjam/connectors'
import type { MusicConnector, CoverArtConnector, Track as ConnectorTrack } from '@partyjam/connectors'

// Music resolution waterfall: YouTube is always tried first (fastest, most reliable)
const musicConnectors: MusicConnector[] = [
  new YouTubeConnector(),
  new MusicBrainzMetadataConnector(),
  new LastFmConnector(),
]

// Cover art waterfall: MusicBrainz (best quality) → iTunes → YouTube thumbnail (always works)
const coverArtConnectors: CoverArtConnector[] = [
  new MusicBrainzCoverArtConnector(),
  new ItunesCoverArtConnector(),
  new YouTubeThumbnailConnector(),
]

export async function resolveCoverArt(track: ConnectorTrack): Promise<string | null> {
  for (const connector of coverArtConnectors) {
    try {
      const url = await connector.resolve(track)
      if (url) return url
    } catch {
      // Try next connector
    }
  }
  return null
}

export class TrackResolver {
  static async hydrateQueuedTrack(input: {
    eventId: string
    trackId: string
    title: string
    artist: string
    youtubeId?: string | null
    connectorTrack?: ConnectorTrack | null
  }): Promise<boolean> {
    const { eventId, trackId, title, artist, youtubeId, connectorTrack } = input
    let filePath: string | null = null
    let isPlayable = false

    if (youtubeId) {
      try {
        filePath = await downloadYouTube(youtubeId)
        await supabase
          .from('tracks')
          .update({ file_path: filePath })
          .eq('id', trackId)
        isPlayable = true
      } catch (err) {
        console.error('[TrackResolver] Download failed:', err)
      }
    }

    if (filePath) {
      try {
        const features = await essentiaClient.analyze({ filePath, title, artist, youtubeId: youtubeId ?? undefined })
        const analyzedDuration = features.duration ?? (features as { duration_seconds?: number }).duration_seconds

        await supabase
          .from('tracks')
          .update({
            essentia_features: features,
            duration: analyzedDuration ? Math.round(analyzedDuration) : null,
          })
          .eq('id', trackId)
      } catch (err) {
        console.error('[TrackResolver] Essentia analysis failed:', err)
        isPlayable = false
        await supabase
          .from('tracks')
          .update({ file_path: null, essentia_features: null, duration: null })
          .eq('id', trackId)
      }
    }

    try {
      const coverTrack = connectorTrack ?? ({
        title,
        artist,
        youtube_id: youtubeId ?? undefined,
      } as ConnectorTrack)
      const coverUrl = await resolveCoverArt(coverTrack)

      if (coverUrl) {
        await supabase
          .from('tracks')
          .update({ cover_url: coverUrl })
          .eq('id', trackId)
      }
    } catch (err) {
      console.error('[TrackResolver] Cover art failed:', err)
    }

    try {
      await QueueEngine.getInstance().reorder(eventId)
    } catch (err) {
      console.error('[TrackResolver] Queue reorder failed:', err)
    }

    try {
      await StreamManager.getInstance().syncEventStream(eventId)
    } catch (err) {
      console.error('[TrackResolver] Stream refresh failed:', err)
    }

    return isPlayable
  }

  static async resolve(
    rawText: string,
    eventId: string,
    guestId: string,
    requestId: string
  ): Promise<void> {
    let resolved: ConnectorTrack | null = null

    // Step 1: Resolve music via connector waterfall
    for (const connector of musicConnectors) {
      try {
        resolved = await connector.resolve(rawText)
        if (resolved) break
      } catch {
        // Try next connector
      }
    }

    if (!resolved) {
      // No connector could find the track — mark request failed
      await supabase
        .from('requests')
        .update({ status: 'failed' })
        .eq('id', requestId)
      console.warn(`[TrackResolver] Could not resolve: "${rawText}"`)
      return
    }

    // Step 2: Insert track immediately (optimistic — guest sees it in queue right away)
    // Supabase real-time will push INSERT event to all subscribers
    const { data: trackRow, error: insertError } = await supabase
      .from('tracks')
      .insert({
        event_id: eventId,
        title: resolved.title,
        artist: resolved.artist,
        youtube_id: resolved.youtube_id ?? null,
        added_by: guestId,
        status: 'queued',
        position: 999,  // QueueEngine.reorder() will assign correct position
      })
      .select()
      .single()

    if (insertError || !trackRow) {
      console.error('[TrackResolver] Insert failed:', insertError)
      await supabase.from('requests').update({ status: 'failed' }).eq('id', requestId)
      return
    }

    const hydrated = await this.hydrateQueuedTrack({
      eventId,
      trackId: trackRow.id,
      title: resolved.title,
      artist: resolved.artist,
      youtubeId: resolved.youtube_id ?? null,
      connectorTrack: resolved,
    })
    // Step 3: Download audio
    let filePath: string | null = null
    if (resolved.youtube_id) {
      try {
        filePath = await downloadYouTube(resolved.youtube_id)
        await supabase
          .from('tracks')
          .update({ file_path: filePath })
          .eq('id', trackRow.id)
      } catch (err) {
        console.error('[TrackResolver] Download failed — removing track:', err)
        await supabase.from('tracks').delete().eq('id', trackRow.id)
        await supabase.from('requests').update({ status: 'failed' }).eq('id', requestId)
        throw err
      }
    } else {
      console.error('[TrackResolver] No youtube_id — cannot download audio')
      await supabase.from('tracks').delete().eq('id', trackRow.id)
      await supabase.from('requests').update({ status: 'failed' }).eq('id', requestId)
      return
    }

    if (!hydrated) {
      await supabase
        .from('tracks')
        .update({ status: 'played', file_path: null, essentia_features: null, duration: null })
        .eq('id', trackRow.id)
      await supabase
        .from('requests')
        .update({ status: 'failed' })
        .eq('id', requestId)
      return
    }

    // Step 6: Mark request as resolved
    await supabase
      .from('requests')
      .update({ status: 'resolved', resolved_track_id: trackRow.id })
      .eq('id', requestId)
  }
}
