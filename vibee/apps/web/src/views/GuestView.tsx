import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MessageCircle, Mic, X } from 'lucide-react'
import { NowPlayingCard } from '../components/NowPlayingCard'
import { QueueView } from '../components/QueueView'
import { MoodJoystick } from '../components/MoodJoystick'
import { ChatAssist } from '../components/ChatAssist'
import { useRealtimeJoystick } from '../hooks/useRealtimeJoystick'
import { useNowPlaying } from '../hooks/useNowPlaying'
import { useRealtimeQueue } from '../hooks/useRealtimeQueue'
import { normalizeEventResponse, type ViewEventState } from '../lib/event-state'
import { mixCornerColor, rgbToCss } from '../lib/moodColor'

export function GuestView() {
  const { id: eventId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [eventState, setEventState] = useState<ViewEventState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [voiceTrigger, setVoiceTrigger] = useState<number | undefined>(undefined)

  // Mood joystick position derived from realtime collective average
  const { collective, setCollective } = useRealtimeJoystick(eventId!, eventState?.collective_joystick)
  const joystickPos = {
    x: (collective.valence + 1) / 2,
    y: (1 - collective.energy) / 2,
  }

  const colorBlend = mixCornerColor(joystickPos.x, joystickPos.y)
  const accentColor = rgbToCss(colorBlend.rgb)
  const collectiveJoystick = {
    valence: Number(collective.valence.toFixed(2)),
    energy: Number(collective.energy.toFixed(2)),
  }
  const pageIntensity = Math.max(0, Math.min(1, (collectiveJoystick.energy + 1) / 2))
  const ambientDurationSeconds = 18 - pageIntensity * 10
  const buttonPulseDuration = Math.max(3.5, ambientDurationSeconds * 0.45)
  const orbDurationA = Math.max(4.5, ambientDurationSeconds * 0.42)
  const orbDurationB = Math.max(5.5, ambientDurationSeconds * 0.56)

  const softBackground = `
    radial-gradient(circle at 15% 12%, ${rgbToCss(colorBlend.rgb, 0.15)} 0%, transparent 34%),
    radial-gradient(circle at 80% 18%, rgba(255,255,255,0.06) 0%, transparent 24%),
    radial-gradient(circle at 72% 86%, ${rgbToCss(colorBlend.rgb, 0.12)} 0%, transparent 30%),
    linear-gradient(180deg, #12141a 0%, #0d1016 42%, #090b10 100%)
  `

  // Get guest identity from localStorage (stored as JSON by JoinView)
  const storedGuest = eventId
    ? localStorage.getItem(`partyjam_guest_${eventId}`)
    : null
  const guestData = storedGuest ? JSON.parse(storedGuest) : null
  const guestId = guestData?.guest_id ?? null

  // Redirect to join page if not joined yet
  useEffect(() => {
    if (!guestId && eventId) {
      navigate(`/join/${eventId}`)
    }
  }, [guestId, eventId, navigate])

  // Initial data fetch
  useEffect(() => {
    if (!eventId) return

    fetch(`/events/${eventId}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Session introuvable' : 'Impossible de charger la session')
        return r.json()
      })
      .then((data) => {
        setEventState(normalizeEventResponse(data))
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [eventId])

  // Real-time now playing (story 7.1)
  const { nowPlaying } = useNowPlaying(eventId!, eventState?.now_playing ?? null)

  // Real-time queue updates (story 7.5)
  const { queue: realtimeQueue } = useRealtimeQueue(eventId!, {
    nowPlaying: null,
    queue: (eventState?.queue ?? []).map((entry) => ({
      ...entry,
      status: 'queued' as const,
    })),
  })

  const suggestionQueue = realtimeQueue.filter((track) => track.added_by === guestId)

  const handleJoystickConfirm = async (x: number, y: number) => {
    const valence = x * 2 - 1
    const energy = -(y * 2 - 1)
    setCollective({ valence, energy })
    if (!eventId || !guestId) return

    const res = await fetch(`/events/${eventId}/joystick`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guest_id: guestId, valence, energy }),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.collective) setCollective(data.collective)
    }
  }

  const eventName = eventState?.event.name?.trim()
  const sessionTitle = `Party JAM - ${eventName}`

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white/40 text-center">
          <div className="text-4xl mb-4 animate-pulse">🎵</div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !eventState) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">😕</div>
          <p className="text-white text-lg">{error ?? 'Session not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-purple-400 text-sm underline"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-[100dvh] items-start justify-center overflow-y-auto px-3 text-[#f3f1eb] selection:bg-white/10 sm:px-4"
      style={{
        background: softBackground,
        paddingTop: 'max(14px, env(safe-area-inset-top))',
        paddingBottom: 'max(18px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(12px, env(safe-area-inset-left))',
        paddingRight: 'max(12px, env(safe-area-inset-right))',
      }}
    >
      <style>{`
        @keyframes guest-wave {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1.2); }
        }
        @keyframes guest-card-pulse {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
        @keyframes guest-orb-a {
          0% { transform: translate(-28%, -14%) scale(0.92); opacity: 0.42; }
          25% { transform: translate(8%, -4%) scale(1.08); opacity: 0.6; }
          50% { transform: translate(34%, 14%) scale(1.04); opacity: 0.46; }
          75% { transform: translate(-4%, 26%) scale(0.95); opacity: 0.58; }
          100% { transform: translate(-28%, -14%) scale(0.92); opacity: 0.42; }
        }
        @keyframes guest-orb-b {
          0% { transform: translate(30%, 18%) scale(0.98); opacity: 0.34; }
          25% { transform: translate(4%, -8%) scale(1.12); opacity: 0.52; }
          50% { transform: translate(-30%, -20%) scale(0.96); opacity: 0.4; }
          75% { transform: translate(-2%, 8%) scale(1.08); opacity: 0.5; }
          100% { transform: translate(30%, 18%) scale(0.98); opacity: 0.34; }
        }
      `}</style>
      <div
        className="flex w-full flex-col gap-2 lowercase tracking-tight sm:gap-2.5"
        style={{ maxWidth: 'min(100%, 500px)' }}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-0.5" aria-hidden="true">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className="block w-[3px] rounded-full"
                  style={{
                    height: 12 + index * 2,
                    backgroundColor: accentColor,
                    animation: `guest-wave 1.1s ease-in-out ${index * 0.15}s infinite`,
                  }}
                />
              ))}
            </div>
            <h1 className="font-['Syne'] font-bold normal-case text-white text-lg truncate">
              {sessionTitle}
            </h1>
          </div>
        </header>

        {/* Now Playing — vinyl card with real data */}
        <NowPlayingCard
          trackName={nowPlaying?.title ?? 'Aucun son en cours'}
          artist={nowPlaying?.artist ?? undefined}
          coverUrl={nowPlaying?.cover_url ?? undefined}
          durationSeconds={nowPlaying?.duration ?? 240}
          elapsedSeconds={nowPlaying?.elapsed_seconds}
          accentColor={accentColor}
          isPlaying={Boolean(nowPlaying)}
        />

        <section className="relative overflow-hidden rounded-[20px] border border-white/8 bg-white/[0.03] p-3 sm:rounded-[24px] sm:p-4">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div
              className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
              style={{
                background: `radial-gradient(circle, ${rgbToCss(colorBlend.rgb, 0.5)} 0%, ${rgbToCss(colorBlend.rgb, 0.18)} 42%, transparent 78%)`,
                animation: `guest-orb-a ${orbDurationA}s ease-in-out infinite`
              }}
            />
            <div
              className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
              style={{
                background: 'radial-gradient(circle, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.12) 44%, transparent 80%)',
                animation: `guest-orb-b ${orbDurationB}s ease-in-out infinite`
              }}
            />
          </div>
          <div className="mb-3 text-center">
            <div className="text-[10px] font-['Space_Mono'] uppercase tracking-[0.18em] text-white/45">
              participer a la playlist
            </div>
            <div className="mt-1 text-[12px] normal-case text-white/72">
              Choisis ta façon de lancer une recherche
            </div>
          </div>
          <div className="relative mx-auto grid w-full max-w-[440px] grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setIsChatOpen(true)}
              className="group flex min-h-[118px] flex-col items-center justify-center rounded-[18px] border px-3 py-4 text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                borderColor: 'rgba(255,255,255,0.3)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 100%)',
                boxShadow: `0 0 16px ${rgbToCss(colorBlend.rgb, 0.15)}`,
                animation: `guest-card-pulse ${buttonPulseDuration}s ease-in-out infinite`
              }}
              aria-label="Ouvrir le chat"
            >
              <div
                className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-full border"
                style={{ borderColor: 'rgba(255,255,255,0.56)', background: 'rgba(0,0,0,0.22)' }}
              >
                <MessageCircle size={24} />
              </div>
              <span className="text-[11px] font-['Manrope'] uppercase tracking-[0.16em] text-white/88">
                proposer un son
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsChatOpen(true)
                setVoiceTrigger((count) => (count ?? 0) + 1)
              }}
              className="group flex min-h-[118px] flex-col items-center justify-center rounded-[18px] border px-3 py-4 text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                borderColor: 'rgba(255,255,255,0.34)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 100%)',
                boxShadow: '0 0 20px rgba(255,255,255,0.14)',
                animation: `guest-card-pulse ${buttonPulseDuration + 0.8}s ease-in-out infinite`
              }}
              aria-label="Parler avec le micro"
            >
              <div
                className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-full border"
                style={{ borderColor: 'rgba(255,255,255,0.52)', background: 'rgba(0,0,0,0.22)' }}
              >
                <Mic size={24} />
              </div>
              <span className="text-[11px] font-['Manrope'] uppercase tracking-[0.16em] text-white/88">
                passer par la voix
              </span>
            </button>
          </div>
        </section>

        {/* Mood Joystick */}
        <MoodJoystick
          onPositionChange={handleJoystickConfirm}
          initialPos={joystickPos}
        />

        {/* Up Next queue */}
        {suggestionQueue.length > 0 ? (
          <div className="rounded-[20px] border border-white/8 bg-white/5 p-3 sm:rounded-[28px] sm:p-4">
            <div className="text-[10px] font-['Space_Mono'] uppercase tracking-[0.18em] text-white/42 mb-3">
              mes suggestion
              <span className="mt-2 block text-[11px] font-['Manrope'] normal-case tracking-normal text-white/52">
                decide la suite de la soiree
              </span>
            </div>
            <QueueView
              tracks={suggestionQueue}
              emptyTitle="Aucune suggestion pour l'instant"
              emptySubtitle="Parle au chatbot pour ajouter une idee."
            />
          </div>
        ) : null}
      </div>

      {isChatOpen ? (
        <div
          className="fixed inset-0 z-50 overflow-hidden bg-[rgba(8,9,11,0.985)]"
          style={{
            paddingTop: 'max(12px, env(safe-area-inset-top))',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            paddingLeft: 'max(12px, env(safe-area-inset-left))',
            paddingRight: 'max(12px, env(safe-area-inset-right))'
          }}
        >
          <button
            type="button"
            onClick={() => setIsChatOpen(false)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-black/45 text-white/80"
            aria-label="Fermer le chat"
          >
            <X size={16} />
          </button>
          <div className="mx-auto flex h-full w-full max-w-[980px] min-h-0">
            <ChatAssist
              eventId={eventId!}
              guestId={guestId!}
              accentColor={accentColor}
              accentRgb={colorBlend.rgb}
              collectiveJoystick={collectiveJoystick}
              hideExpandControl
              forceExpanded
              onRequestClose={() => setIsChatOpen(false)}
              voiceTrigger={voiceTrigger}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
