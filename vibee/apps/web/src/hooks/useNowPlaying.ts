import { useEffect, useRef, useState } from 'react'
import { normalizeNowPlaying, type ViewTrack } from '../lib/event-state'
import { supabase } from '../lib/supabase'

interface NowPlayingTrack {
  id: string
  title: string
  artist: string
  cover_url: string | null
  duration: number | null
  started_at?: string | null
  elapsed_seconds?: number
}

/**
 * Subscribes to real-time now_playing updates via Supabase postgres_changes.
 * Falls back to polling every 5s if WebSocket is unavailable.
 */
export function useNowPlaying(eventId: string, initial: NowPlayingTrack | null) {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingTrack | null>(() => hydrateElapsed(initial))
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchNowPlaying = async () => {
    try {
      const res = await fetch(`/events/${eventId}`)
      if (!res.ok) return
      const data = await res.json()
      if ('now_playing' in data) {
        setNowPlaying(hydrateElapsed(normalizeNowPlaying(data.now_playing)))
      }
    } catch {
      // Network error — keep last known state
    }
  }

  useEffect(() => {
    if (!eventId) return

    if (!supabase) {
      // No Supabase — polling only
      pollRef.current = setInterval(fetchNowPlaying, 5000)
      return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }

    // Subscribe to tracks table changes (status change → now_playing changes)
    const channel = supabase
      .channel(`event:${eventId}:now-playing`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tracks',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          fetchNowPlaying()
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          fetchNowPlaying()
        }
      })

    // Keep elapsed_seconds synchronized even when no DB event is emitted.
    pollRef.current = setInterval(fetchNowPlaying, 5000)

    return () => {
      supabase!.removeChannel(channel)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [eventId])

  useEffect(() => {
    setNowPlaying(hydrateElapsed(initial))
  }, [initial])

  useEffect(() => {
    tickRef.current = setInterval(() => {
      setNowPlaying((current) => {
        if (!current || typeof current.elapsed_seconds !== 'number') {
          return current
        }
        return hydrateElapsed(current)
      })
    }, 1000)

    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  return { nowPlaying, setNowPlaying }
}

function hydrateElapsed(track: NowPlayingTrack | null): NowPlayingTrack | null {
  if (!track) {
    return null
  }

  const duration = typeof track.duration === 'number' && track.duration > 0 ? track.duration : null
  const startedAt = track.started_at ? new Date(track.started_at).getTime() : NaN

  if (Number.isFinite(startedAt) && startedAt > 0) {
    const computed = Math.max(0, (Date.now() - startedAt) / 1000)
    return {
      ...track,
      elapsed_seconds: duration ? Math.min(computed, duration) : computed,
    }
  }

  const currentElapsed = typeof track.elapsed_seconds === 'number' ? track.elapsed_seconds : 0
  return {
    ...track,
    elapsed_seconds: duration ? Math.min(currentElapsed, duration) : currentElapsed,
  }
}
