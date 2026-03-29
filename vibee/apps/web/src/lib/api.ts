import type { CreateEventRequest, CreateEventResponse, GetEventResponse } from '@partyjam/shared'

export function resolveApiBase() {
  const configured = import.meta.env.VITE_API_URL?.replace(/\/+$/, '')
  if (configured) {
    return configured
  }

  if (typeof window !== 'undefined') {
    if (window.location.port === '5173') {
      return ''
    }

    return window.location.origin.replace(/\/+$/, '')
  }

  return ''
}

const BASE = resolveApiBase()

interface JoinEventResponse {
  guest_id: string
  display_name: string
  emoji: string
}

export const api = {
  createEvent: async (body: CreateEventRequest): Promise<CreateEventResponse> => {
    const res = await fetch(`${BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  getEvent: async (eventId: string): Promise<GetEventResponse> => {
    const res = await fetch(`${BASE}/events/${eventId}`)
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  joinEvent: async (eventId: string, displayName: string): Promise<JoinEventResponse> => {
    const res = await fetch(`${BASE}/events/${eventId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName }),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  updateJoystick: async (
    eventId: string,
    guestId: string,
    valence: number,
    energy: number
  ): Promise<{ collective: { valence: number; energy: number } } | null> => {
    try {
      const res = await fetch(`${BASE}/events/${eventId}/joystick`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_id: guestId, valence, energy }),
      })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  },
}
