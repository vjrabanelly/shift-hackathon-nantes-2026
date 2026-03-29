import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface CollectivePosition {
  valence: number
  energy: number
}

export function useRealtimeJoystick(eventId: string, initialCollective?: CollectivePosition) {
  const [collective, setCollective] = useState<CollectivePosition>(
    initialCollective ?? { valence: 0, energy: 0 }
  )

  // Sync initial collective when it arrives from the event fetch
  useEffect(() => {
    if (initialCollective) {
      setCollective(initialCollective)
    }
  }, [initialCollective?.valence, initialCollective?.energy])

  useEffect(() => {
    if (!eventId || !supabase) return

    const channel = supabase
      .channel(`event:${eventId}:joystick`)
      .on(
        'broadcast',
        { event: 'collective' },
        (payload: { payload: { collective: CollectivePosition } }) => {
          if (payload?.payload?.collective) {
            setCollective(payload.payload.collective)
          }
        }
      )
      .subscribe()

    return () => {
      supabase!.removeChannel(channel)
    }
  }, [eventId])

  return { collective, setCollective }
}
