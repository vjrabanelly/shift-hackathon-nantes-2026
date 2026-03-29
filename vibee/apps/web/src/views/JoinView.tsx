import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

const STORAGE_KEY = (eventId: string) => `partyjam_guest_${eventId}`

export function JoinView() {
  const { id: eventId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [eventName, setEventName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!eventId) return

    // Check if already joined
    const stored = localStorage.getItem(STORAGE_KEY(eventId))
    if (stored) {
      navigate(`/join/${eventId}/play`, { replace: true })
      return
    }

    // Load event name
    api.getEvent(eventId)
      .then((data) => setEventName(data.event.name))
      .catch(() => setEventName('Party JAM'))

    // Autofocus the input
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [eventId, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventId || !displayName.trim()) return

    setLoading(true)
    setError(null)

    try {
      const guest = await api.joinEvent(eventId, displayName.trim())

      // Persist to localStorage
      localStorage.setItem(
        STORAGE_KEY(eventId),
        JSON.stringify({
          guest_id: guest.guest_id,
          display_name: guest.display_name,
          emoji: guest.emoji,
        })
      )

      navigate(`/join/${eventId}/play`)
    } catch {
      setError('Failed to join. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Event name */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold">
            {eventName ?? 'Loading...'}
          </h1>
          <p className="text-gray-400 mt-2">Join the party</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            maxLength={30}
            className="w-full bg-gray-800 rounded-xl px-5 py-4 text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            autoComplete="off"
            autoCapitalize="words"
          />

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !displayName.trim()}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl py-4 text-lg font-bold transition-colors"
          >
            {loading ? 'Joining...' : '🎵 Join the Party'}
          </button>
        </form>
      </div>
    </div>
  )
}
