import { useState, useCallback } from 'react'

interface Props {
  eventId: string
  guestId: string
  onRequestSubmitted?: (requestId: string) => void
}

export function RequestInput({ eventId, guestId, onRequestSubmitted }: Props) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'pending' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const submit = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || status === 'pending') return

    setStatus('pending')
    setErrorMsg('')

    try {
      const res = await fetch(`/events/${eventId}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_id: guestId, raw_text: trimmed }),
      })

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`)
      }

      const data = await res.json()
      setText('')
      setStatus('idle')
      onRequestSubmitted?.(data.request_id)
    } catch {
      setStatus('error')
      setErrorMsg('Could not submit request. Try again.')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }, [text, status, eventId, guestId, onRequestSubmitted])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {status === 'error' && (
        <p className="text-red-400 text-xs text-center px-4">{errorMsg}</p>
      )}

      <div className="flex items-center gap-2 px-4 py-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={status === 'pending'}
          placeholder="Request a song..."
          className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={status === 'pending' || !text.trim()}
          className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center disabled:opacity-40 flex-shrink-0"
          aria-label="Send request"
        >
          {status === 'pending' ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
