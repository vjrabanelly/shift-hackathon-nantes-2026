import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface Track {
  id: string
  title: string
  artist: string
  cover_url: string | null
  duration: number | null
  status: 'queued' | 'playing' | 'played'
  position: number
  added_by: string
  added_by_display: string
  file_path: string | null
  elapsed_seconds?: number
}

export interface QueueState {
  nowPlaying: Track | null
  queue: Track[]
}

export function useRealtimeQueue(eventId: string, initialState?: QueueState): QueueState {
  const [state, setState] = useState<QueueState>(
    initialState ?? { nowPlaying: null, queue: [] }
  )
  const seededRef = useRef(false)

  // Seed state from initialState once it becomes available (async fetch)
  useEffect(() => {
    if (seededRef.current || !initialState) return
    if (initialState.queue.length > 0 || initialState.nowPlaying) {
      seededRef.current = true
      setState(initialState)
    }
  }, [initialState])

  const mergeTrackUpdate = useCallback((updatedTrack: Track) => {
    setState((prev) => {
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

      // queued — insert or update
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
    })
  }, [])

  useEffect(() => {
    if (!eventId || !supabase) return

    const channel = supabase
      .channel(`event:${eventId}:tracks`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tracks',
          filter: `event_id=eq.${eventId}`,
        },
        (payload: { eventType: string; old: unknown; new: unknown }) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id
            setState((prev) => ({
              nowPlaying: prev.nowPlaying?.id === deletedId ? null : prev.nowPlaying,
              queue: prev.queue.filter((t) => t.id !== deletedId),
            }))
            return
          }

          const raw = payload.new as Track & { added_by: string }
          const track: Track = {
            ...raw,
            added_by_display:
              raw.added_by === 'ai' ? '✨ IA' : raw.added_by_display ?? '🎵 Invite',
          }
          mergeTrackUpdate(track)
        }
      )
      .subscribe()

    return () => {
      supabase!.removeChannel(channel)
    }
  }, [eventId, mergeTrackUpdate])

  return state
}
