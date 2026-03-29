import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { NowPlaying } from '../components/NowPlaying'
import { QueueView } from '../components/QueueView'
import { normalizeEventResponse, type ViewEventState } from '../lib/event-state'

export function AdminView() {
  const { eventId } = useParams<{ eventId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [adminToken, setAdminToken] = useState<string | null>(null)
  const [eventState, setEventState] = useState<ViewEventState | null>(null)
  const [loading, setLoading] = useState(true)
  const [skipStatus, setSkipStatus] = useState<'idle' | 'skipping'>('idle')
  const [removingTrackId, setRemovingTrackId] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<'play' | null>(null)
  const [rightTab, setRightTab] = useState<'queue' | 'history'>('queue')
  const [replayStatus, setReplayStatus] = useState<'idle' | 'loading'>('idle')

  const copyToClipboard = (text: string, key: 'play') => {
    navigator.clipboard.writeText(text)
    setCopiedUrl(key)
    setTimeout(() => setCopiedUrl(null), 1500)
  }

  // Store token from URL in localStorage on first load
  useEffect(() => {
    const tokenFromUrl = searchParams.get('token')
    const storedToken = localStorage.getItem(`partyjam_admin_${eventId}`)

    if (tokenFromUrl) {
      localStorage.setItem(`partyjam_admin_${eventId}`, tokenFromUrl)
      setAdminToken(tokenFromUrl)
      // Remove token from URL (security hygiene — don't keep it in address bar)
      navigate(`/admin/${eventId}`, { replace: true })
    } else if (storedToken) {
      setAdminToken(storedToken)
    } else {
      // No token — show error
      setLoading(false)
    }
  }, [eventId, searchParams, navigate])

  // Fetch event state
  const fetchState = useCallback(async () => {
    if (!eventId) return
    try {
      const res = await fetch(`/events/${eventId}`)
      if (!res.ok) return
      setEventState(normalizeEventResponse(await res.json()))
    } catch {}
  }, [eventId])

  useEffect(() => {
    fetchState().then(() => setLoading(false))
    const interval = setInterval(fetchState, 5000)
    return () => clearInterval(interval)
  }, [fetchState])

  const handleSkip = async () => {
    if (!adminToken || skipStatus === 'skipping') return
    setSkipStatus('skipping')

    try {
      const res = await fetch(`/events/${eventId}/skip`, {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
      })
      if (res.ok) {
        fetchState()
      }
    } catch {
    } finally {
      setSkipStatus('idle')
    }
  }

  const handleReplayHistory = async () => {
    if (!adminToken || replayStatus === 'loading') return
    setReplayStatus('loading')
    try {
      await fetch(`/events/${eventId}/history/replay`, {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
      })
      await fetchState()
    } catch {}
    setReplayStatus('idle')
  }

  const handleRemoveTrack = async (trackId: string) => {
    if (!adminToken) return
    setRemovingTrackId(trackId)

    try {
      const res = await fetch(`/events/${eventId}/tracks/${trackId}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken },
      })

      if (res.ok) {
        setEventState((prev) =>
          prev
            ? {
                ...prev,
                queue: prev.queue.filter((track) => track.id !== trackId),
                tracks: prev.tracks.filter((track) => track.id !== trackId),
              }
            : prev
        )
      } else {
        alert('Failed to remove track')
      }
    } catch {
      alert('Network error')
    }

    setRemovingTrackId(null)
  }

  const nowPlayingTrack = eventState?.now_playing
    ? { ...eventState.now_playing, elapsed_seconds: eventState.now_playing.elapsed_seconds ?? 0 }
    : null

  const browserPlayerUrl = eventId && nowPlayingTrack
    ? `/events/${eventId}/now-playing/audio?t=${nowPlayingTrack.id}`
    : null

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Loading...
      </div>
    )
  }

  if (!adminToken) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white text-center px-4">
        <div>
          <p className="text-xl mb-2">Admin access required</p>
          <p className="text-gray-400 text-sm">Open this URL with ?token=your-admin-token</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">🎛️ {eventState?.event?.name ?? 'Party JAM'} — Admin</h1>
          <span className="text-sm text-gray-400">
            👥 {eventState?.guests_count ?? '?'} guests
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column: Controls */}
          <div className="flex flex-col gap-4">
            <div className="bg-gray-800 rounded-xl p-4">
              <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-3">Guest Play URL</h2>
              {eventId ? (
                <div className="flex flex-col gap-2">
                  <code className="text-xs text-blue-400 break-all bg-black/30 p-2 rounded">
                    {`${window.location.origin}/join/${eventId}/play`}
                  </code>
                  <button
                    onClick={() => copyToClipboard(`${window.location.origin}/join/${eventId}/play`, 'play')}
                    className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 active:scale-95 text-sm py-1.5 rounded transition-all cursor-pointer"
                  >
                    {copiedUrl === 'play' ? '✅ Copied!' : '📋 Copy URL'}
                  </button>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No event loaded</p>
              )}
            </div>

            <div className="bg-gray-800 rounded-xl p-4">
              <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-3">Now Playing</h2>
              <NowPlaying nowPlaying={nowPlayingTrack} audioUrl={browserPlayerUrl ?? undefined} />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleSkip}
                  disabled={skipStatus === 'skipping' || !eventState?.now_playing}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-30 py-2 rounded font-medium transition-colors"
                >
                  {skipStatus === 'skipping' ? '⏳ Skipping...' : '⏭ Skip Track'}
                </button>
              </div>
            </div>

            {eventState?.event?.qr_code_url && (
              <div className="bg-gray-800 rounded-xl p-4">
                <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-3">Guest Join QR</h2>
                <img src={eventState.event.qr_code_url} alt="QR code" className="w-32 h-32" />
                <p className="text-xs text-gray-400 mt-2">/join/{eventId}</p>
              </div>
            )}
          </div>

          {/* Right column: Queue / History tabs */}
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex gap-1 mb-4">
              <button
                onClick={() => setRightTab('queue')}
                className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${rightTab === 'queue' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Queue ({eventState?.queue.length ?? 0})
              </button>
              <button
                onClick={() => setRightTab('history')}
                className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${rightTab === 'history' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                History ({eventState?.history.length ?? 0})
              </button>
            </div>
            {rightTab === 'queue' ? (
              <QueueView
                tracks={eventState?.queue ?? []}
                onRemove={handleRemoveTrack}
                removingId={removingTrackId}
              />
            ) : (
              <>
                <QueueView
                  tracks={eventState?.history ?? []}
                  emptyTitle="No tracks played yet"
                  emptySubtitle="History will appear here"
                />
                {(eventState?.history.length ?? 0) > 0 && (
                  <button
                    onClick={handleReplayHistory}
                    disabled={replayStatus === 'loading'}
                    className="w-full mt-4 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 py-2 rounded font-medium text-sm transition-colors cursor-pointer"
                  >
                    {replayStatus === 'loading' ? '⏳ Restoring...' : '🔁 Replay History'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
