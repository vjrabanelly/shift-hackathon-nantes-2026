import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowUp,
  Check,
  ExternalLink,
  RefreshCcw,
  LoaderCircle,
  MessageCircle,
  Mic,
  Play,
  X
} from 'lucide-react'
import {
  SearchCandidate,
  SearchTrace,
  TrackSource,
  useMusicAgentSession
} from '../useMusicAgentSession'

interface Props {
  eventId: string
  guestId: string
  accentColor: string
  accentRgb?: number[]
  hideExpandControl?: boolean
  forceExpanded?: boolean
  onRequestClose?: () => void
  voiceTrigger?: number
  voiceStopTrigger?: number
  autoPrompt?: string | null
  onAutoPromptConsumed?: () => void
  collectiveJoystick: {
    valence: number
    energy: number
  }
}

interface PreviewState {
  candidate: SearchCandidate
  source: TrackSource
}

export function ChatAssist({
  eventId,
  guestId,
  accentColor,
  accentRgb,
  collectiveJoystick,
  hideExpandControl = false,
  forceExpanded = false,
  onRequestClose,
  voiceTrigger,
  voiceStopTrigger,
  autoPrompt,
  onAutoPromptConsumed
}: Props) {
  const rgb = accentRgb ?? [63, 224, 138]
  const rgbToCss = (alpha: number) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`

  const {
    session,
    isBooting,
    isSending,
    pendingTraces,
    error,
    sendMessage,
    selectPreviewSource,
    rejectCandidate,
    confirmCandidate,
    clearSession,
    transcribeAudio
  } = useMusicAgentSession(eventId, guestId)

  const [chatValue, setChatValue] = useState('')
  const [isChatExpanded, setIsChatExpanded] = useState(false)
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false)

  const chatInlineScrollRef = useRef<HTMLDivElement>(null)
  const chatExpandedScrollRef = useRef<HTMLDivElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recorderChunksRef = useRef<BlobPart[]>([])
  const recorderStreamRef = useRef<MediaStream | null>(null)
  const lastVoiceTriggerRef = useRef<number | undefined>(undefined)
  const lastVoiceStopTriggerRef = useRef<number | undefined>(undefined)
  const lastAutoPromptRef = useRef<string | null>(null)

  useEffect(() => {
    const updateViewportHeight = () => {
      const nextHeight =
        typeof window !== 'undefined' ? window.visualViewport?.height ?? window.innerHeight : null
      setViewportHeight(nextHeight ?? null)
    }

    updateViewportHeight()
    window.addEventListener('resize', updateViewportHeight)
    window.visualViewport?.addEventListener('resize', updateViewportHeight)
    window.visualViewport?.addEventListener('scroll', updateViewportHeight)
    return () => {
      window.removeEventListener('resize', updateViewportHeight)
      window.visualViewport?.removeEventListener('resize', updateViewportHeight)
      window.visualViewport?.removeEventListener('scroll', updateViewportHeight)
    }
  }, [])

  useEffect(() => {
    const scrollTargets = [chatInlineScrollRef.current, chatExpandedScrollRef.current]
    scrollTargets.forEach((target) => {
      if (target) {
        target.scrollTop = target.scrollHeight
      }
    })
  }, [session?.messages, isChatExpanded, isSending])

  useEffect(() => {
    document.body.style.overflow = isChatExpanded || previewState ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isChatExpanded, previewState])

  useEffect(() => {
    if (!previewState || !session) {
      return
    }

    const stillExists = session.messages.some((message) =>
      message.candidates?.some((candidate) => candidate.id === previewState.candidate.id)
    )

    if (!stillExists) {
      setPreviewState(null)
    }
  }, [previewState, session])

  useEffect(() => {
    return () => {
      stopVoiceStream()
    }
  }, [])

  useEffect(() => {
    if (voiceTrigger === undefined) {
      return
    }
    if (lastVoiceTriggerRef.current === voiceTrigger) {
      return
    }
    lastVoiceTriggerRef.current = voiceTrigger
    void startVoiceCapture()
  }, [voiceTrigger])

  useEffect(() => {
    if (voiceStopTrigger === undefined) {
      return
    }
    if (lastVoiceStopTriggerRef.current === voiceStopTrigger) {
      return
    }
    lastVoiceStopTriggerRef.current = voiceStopTrigger
    stopVoiceCapture()
  }, [voiceStopTrigger])

  useEffect(() => {
    if (!autoPrompt || isBooting || isSending) {
      return
    }
    if (lastAutoPromptRef.current === autoPrompt) {
      return
    }
    lastAutoPromptRef.current = autoPrompt
    setChatValue('')
    void sendMessage(autoPrompt, collectiveJoystick).finally(() => {
      onAutoPromptConsumed?.()
    })
  }, [autoPrompt, collectiveJoystick, isBooting, isSending, onAutoPromptConsumed, sendMessage])

  const submitPrompt = async () => {
    if (isRecordingVoice) {
      stopVoiceCapture()
      return
    }

    const prompt = chatValue.trim()
    if (!prompt || isSending) {
      return
    }

    setChatValue('')
    try {
      await sendMessage(prompt, collectiveJoystick)
    } catch {
      setChatValue(prompt)
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    void submitPrompt()
  }

  const handlePreviewCandidate = async (candidate: SearchCandidate, source = candidate.primary_source) => {
    const payload = await selectPreviewSource(candidate.id, source.id)
    setPreviewState({
      candidate: payload.candidate,
      source: payload.selected_source
    })
  }

  const handleRejectCandidate = async (candidateId: string) => {
    if (previewState?.candidate.id === candidateId) {
      setPreviewState(null)
    }
    await rejectCandidate(candidateId)
  }

  const handleConfirmCandidate = async (candidateId: string) => {
    if (previewState?.candidate.id === candidateId) {
      setPreviewState(null)
    }
    await confirmCandidate(candidateId)
  }

  const handleClearSession = async () => {
    if (isResetting) {
      return
    }

    setIsResetting(true)
    setPreviewState(null)
    setChatValue('')

    try {
      await clearSession()
    } finally {
      setIsResetting(false)
    }
  }

  const stopVoiceStream = () => {
    if (recorderStreamRef.current) {
      recorderStreamRef.current.getTracks().forEach((track) => track.stop())
      recorderStreamRef.current = null
    }
  }

  const stopVoiceCapture = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    } else {
      setIsRecordingVoice(false)
      stopVoiceStream()
    }
  }

  const startVoiceCapture = async () => {
    if (isRecordingVoice || isTranscribingVoice) {
      return
    }

    if (typeof window === 'undefined' || !window.navigator?.mediaDevices?.getUserMedia) {
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      return
    }

    try {
      const stream = await window.navigator.mediaDevices.getUserMedia({ audio: true })
      recorderStreamRef.current = stream
      recorderChunksRef.current = []
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recorderChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        setIsRecordingVoice(false)
        const audioBlob = new Blob(recorderChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        recorderChunksRef.current = []
        stopVoiceStream()
        recorderRef.current = null

        if (audioBlob.size === 0) {
          return
        }

        setIsTranscribingVoice(true)
        try {
          const transcript = await transcribeAudio(audioBlob, recorder.mimeType || 'audio/webm')
          if (!transcript) {
            return
          }
          setChatValue('')
          await sendMessage(transcript, collectiveJoystick)
        } catch {
          // Error state is already handled in useMusicAgentSession.
        } finally {
          setIsTranscribingVoice(false)
        }
      }

      recorder.start(200)
      setIsRecordingVoice(true)
    } catch {
      setIsRecordingVoice(false)
      stopVoiceStream()
    }
  }

  const toggleVoiceCapture = () => {
    if (isRecordingVoice) {
      stopVoiceCapture()
      return
    }
    void startVoiceCapture()
  }

  const expandedPanelHeight =
    viewportHeight !== null
      ? `max(320px, calc(${Math.round(viewportHeight)}px - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 24px))`
      : 'calc(100dvh - 24px)'
  const renderExpandedLayout = forceExpanded || isChatExpanded

  const messages = session?.messages ?? []

  const renderCandidateCard = (candidate: SearchCandidate) => {
    const selectedSourceId = session?.selected_preview_by_candidate?.[candidate.id]
    const previewSource =
      previewState?.candidate.id === candidate.id
        ? candidate.sources.find((source) => source.id === previewState.source.id)
        : undefined
    const activeSource =
      candidate.sources.find((source) => source.id === selectedSourceId) ??
      previewSource ??
      candidate.primary_source
    const displaySource = activeSource ?? candidate.sources[0]

    if (!displaySource) {
      return null
    }
    const artworkUrl = resolveCandidateArtworkUrl(candidate, displaySource)

    return (
      <div
        key={candidate.id}
        className="mt-3 rounded-[16px] border px-3 py-3"
        style={{
          background: 'rgba(255,255,255,0.03)',
          borderColor: 'rgba(255,255,255,0.06)'
        }}
      >
        <div className="flex items-stretch gap-2">
          <div className="min-w-0 flex-1 py-0.5">
            <div className="truncate font-['Syne'] text-[15px] font-bold normal-case text-white">
              {candidate.title}
            </div>
            <div className="truncate text-[12px] normal-case text-white/56">
              {candidate.artist}
            </div>

            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {candidate.genres.slice(0, 3).map((genre) => (
                <span
                  key={genre}
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-['Manrope'] uppercase tracking-[0.12em] text-white/58"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  {genre}
                </span>
              ))}
            </div>

            <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] font-['Manrope'] uppercase tracking-[0.12em] text-white/46">
              <span>{candidate.metrics?.bpm ? `${Math.round(candidate.metrics.bpm)} BPM` : 'tempo libre'}</span>
              <span>{candidate.metrics?.energy ? `${Math.round(candidate.metrics.energy * 100)}% energie` : 'energie n/a'}</span>
              <span>{formatPlayCount(candidate.metrics?.play_count)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handlePreviewCandidate(candidate, displaySource)}
            className="group relative w-[80px] shrink-0 overflow-hidden rounded-[12px] border border-white/10"
            style={{
              backgroundImage: artworkUrl
                ? `linear-gradient(180deg, rgba(11,12,14,0.12), rgba(11,12,14,0.28)), url(${artworkUrl})`
                : `linear-gradient(135deg, ${rgbToCss(0.28)}, rgba(255,255,255,0.04))`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
            aria-label={`ecouter ${candidate.title}`}
          >
            <span className="absolute inset-0 flex items-center justify-center bg-[rgba(7,8,10,0.2)] text-white/90 transition group-hover:bg-[rgba(7,8,10,0.34)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-[rgba(0,0,0,0.24)]">
                <Play size={16} />
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handleConfirmCandidate(candidate.id)}
            className="flex w-[52px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[12px] text-white"
            style={{
              background: `linear-gradient(135deg, ${rgbToCss(0.92)}, ${rgbToCss(0.72)})`
            }}
          >
            <Check size={20} />
          </button>
        </div>
      </div>
    )
  }

  const renderMessages = (scrollRef: React.RefObject<HTMLDivElement | null>, expanded = false) => (
    <div
      ref={scrollRef}
      className={`flex flex-col gap-2.5 overflow-y-auto pr-1 ${expanded ? 'min-h-0 flex-1' : ''}`}
      style={{ maxHeight: expanded ? 'none' : 'clamp(180px, 32svh, 360px)' }}
    >
      {messages.map((message) => {
        const isUser = message.role === 'user'
        return (
          <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
              className="rounded-[16px] border px-3.5 py-2.5 sm:px-4 sm:py-3"
              style={{
                maxWidth: expanded ? 'min(92%, 38rem)' : 'min(92%, 32rem)',
                background: isUser
                  ? `linear-gradient(135deg, ${rgbToCss(0.24)}, ${rgbToCss(0.14)})`
                  : 'rgba(255,255,255,0.035)',
                borderColor: isUser ? rgbToCss(0.32) : 'rgba(255,255,255,0.06)'
              }}
            >
              <div className="text-[12px] leading-relaxed normal-case text-white/84 sm:text-[13px]">
                {message.text}
              </div>
              {message.candidates?.map(renderCandidateCard)}
            </div>
          </div>
        )
      })}

      {isSending ? (
        <div className="flex justify-start">
          <div
            className="rounded-[16px] border px-3.5 py-3 sm:px-4 sm:py-3"
            style={{ background: 'rgba(255,255,255,0.035)', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            {pendingTraces.length > 0 ? (
              <>
                <div className="flex items-center gap-2 text-[12px] normal-case text-white/72">
                  <LoaderCircle size={14} className="animate-spin" />
                  je cherche en parallele sur plusieurs sources...
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  {buildFriendlySearchSteps(pendingTraces).map((step) => (
                    <div key={step} className="text-[11px] normal-case text-white/48">
                      {step}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-[12px] normal-case text-white/72">
                <LoaderCircle size={14} className="animate-spin" />
                ajout a la playlist en cours, je telecharge la piste...
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )

  return (
    <>
      <div
        className={
          renderExpandedLayout
            ? 'flex h-full min-h-0 flex-col rounded-[18px] border p-3 sm:rounded-[22px] sm:p-4'
            : 'rounded-[14px] p-2.5 sm:rounded-[16px] sm:p-3'
        }
        style={{
          background: 'linear-gradient(180deg, rgba(20, 22, 25, 0.96) 0%, rgba(15, 17, 19, 0.98) 100%)',
          borderColor: 'rgba(255,255,255,0.03)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)'
        }}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-['Manrope'] uppercase tracking-[0.18em] text-white/48">
              agent musique
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleClearSession()}
              disabled={isResetting}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-['Manrope'] uppercase tracking-[0.14em] text-white/58 transition-colors hover:text-white disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.04)' }}
            >
              {isResetting ? <LoaderCircle size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
              effacer
            </button>
            {!hideExpandControl && !forceExpanded ? (
              <button
                type="button"
                onClick={() => setIsChatExpanded(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full border text-white/62 transition-colors hover:text-white"
                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.04)' }}
                aria-label="Ouvrir le chat en plein ecran"
              >
                <MessageCircle size={15} />
              </button>
            ) : null}
            {onRequestClose ? (
              <button
                type="button"
                onClick={onRequestClose}
                className="flex h-8 w-8 items-center justify-center rounded-full border text-white/62 transition-colors hover:text-white"
                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.04)' }}
                aria-label="Fermer le chat"
              >
                <X size={15} />
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="mb-3 rounded-[14px] border border-[#ff9a9a]/25 bg-[#ff9a9a]/8 px-3 py-2 text-[12px] normal-case text-[#ffd7d7]">
            L'agent a eu un souci temporaire: {error}
          </div>
        ) : null}

        {isBooting ? (
          <div className="flex items-center gap-2 rounded-[16px] border border-white/8 bg-white/4 px-4 py-4 text-[12px] normal-case text-white/72">
            <LoaderCircle size={15} className="animate-spin" />
            initialisation de l'agent musique...
          </div>
        ) : (
          renderMessages(
            renderExpandedLayout ? chatExpandedScrollRef : chatInlineScrollRef,
            renderExpandedLayout
          )
        )}

        <form onSubmit={handleSubmit} className="mt-2">
          <div className="flex gap-2">
            <div
              className="flex flex-1 items-center rounded-[18px] border sm:rounded-[22px]"
              style={{
                minHeight: 'clamp(40px, 5.8svh, 48px)',
                background: 'rgba(255,255,255,0.035)',
                borderColor: 'rgba(255,255,255,0.04)'
              }}
            >
              <textarea
                value={chatValue}
                onChange={(event) => setChatValue(event.target.value)}
                placeholder="quelle musique vous voulez mettre apres ?"
                rows={1}
                className="flex-1 resize-none bg-transparent px-4 py-3 text-[16px] italic text-white/78 outline-none placeholder:text-white/28 sm:px-5 sm:py-4"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void submitPrompt()
                  }
                }}
              />
              <button
                type="button"
                onClick={toggleVoiceCapture}
                disabled={isTranscribingVoice}
                className="pr-3 text-white/50 transition-colors hover:text-white disabled:opacity-50 sm:pr-4"
                aria-label={isRecordingVoice ? 'Arreter la dictée' : 'Lancer la dictée'}
              >
                {isRecordingVoice ? <LoaderCircle size={16} className="animate-spin" /> : <Mic size={16} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={isSending || isTranscribingVoice}
              className="flex shrink-0 items-center justify-center rounded-[18px] border text-white transition-transform active:scale-[0.98] disabled:opacity-50 sm:rounded-[22px]"
              style={{
                backgroundColor: accentColor,
                width: 'clamp(42px, 10vw, 52px)',
                borderColor: rgbToCss(0.6),
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)'
              }}
            >
              {isSending ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : isRecordingVoice ? (
                <Mic size={18} />
              ) : (
                <ArrowUp size={18} />
              )}
            </button>
          </div>
          {isRecordingVoice || isTranscribingVoice ? (
            <div className="mt-2 text-[11px] normal-case text-white/60">
              {isRecordingVoice ? 'J’écoute... appuie sur envoyer pour arrêter.' : 'Transcription en cours...'}
            </div>
          ) : null}
        </form>
      </div>

      {!forceExpanded && isChatExpanded && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          style={{
            background: 'rgba(8,9,11,0.985)',
            paddingTop: 'max(12px, env(safe-area-inset-top))',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            paddingLeft: 'max(12px, env(safe-area-inset-left))',
            paddingRight: 'max(12px, env(safe-area-inset-right))'
          }}
        >
          <div
            className="mx-auto flex w-full max-w-[720px] flex-col rounded-[24px] border"
            style={{
              minHeight: expandedPanelHeight,
              maxHeight: expandedPanelHeight,
              background: 'linear-gradient(180deg, rgba(20, 22, 25, 0.96) 0%, rgba(15, 17, 19, 0.98) 100%)',
              borderColor: 'rgba(255,255,255,0.03)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)'
            }}
          >
            <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              <div>
                <div className="text-[10px] font-['Manrope'] uppercase tracking-[0.18em] text-white/42">
                  mode focus
                </div>
                <div className="mt-1 text-[18px] font-['Bebas_Neue'] font-bold normal-case text-white/92">
                  agent musique
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleClearSession()}
                  disabled={isResetting}
                  className="flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-['Manrope'] uppercase tracking-[0.14em] text-white/70 disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.04)' }}
                >
                  {isResetting ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                  effacer
                </button>
                <button
                  type="button"
                  onClick={() => setIsChatExpanded(false)}
                  className="flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-['Manrope'] uppercase tracking-[0.14em] text-white/70"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.04)' }}
                >
                  <ArrowLeft size={14} />
                  retour
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-5 sm:py-5">
              {renderMessages(chatExpandedScrollRef, true)}

              <form onSubmit={handleSubmit} className="mt-4 border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <div className="flex gap-2.5">
                  <div
                    className="flex flex-1 items-center rounded-[18px] border sm:rounded-[22px]"
                    style={{
                      minHeight: 'clamp(64px, 12svh, 104px)',
                      background: 'rgba(255,255,255,0.035)',
                      borderColor: 'rgba(255,255,255,0.04)'
                    }}
                  >
                    <textarea
                      value={chatValue}
                      onChange={(event) => setChatValue(event.target.value)}
                      placeholder="decris le morceau, une vibe, un artiste ou quelques paroles..."
                      rows={2}
                      className="flex-1 resize-none bg-transparent px-4 py-3 text-[16px] italic text-white/78 outline-none placeholder:text-white/28 sm:px-5 sm:py-4"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          void submitPrompt()
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={toggleVoiceCapture}
                      disabled={isTranscribingVoice}
                      className="self-end pb-3 pr-3 text-white/50 transition-colors hover:text-white disabled:opacity-50 sm:pb-4 sm:pr-4"
                      aria-label={isRecordingVoice ? 'Arreter la dictée' : 'Lancer la dictée'}
                    >
                      {isRecordingVoice ? <LoaderCircle size={16} className="animate-spin" /> : <Mic size={16} />}
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={isSending || isTranscribingVoice}
                    className="flex shrink-0 items-center justify-center rounded-[18px] border text-white transition-transform active:scale-[0.98] disabled:opacity-50 sm:rounded-[22px]"
                    style={{
                      backgroundColor: accentColor,
                      width: 'clamp(48px, 12vw, 64px)',
                      borderColor: rgbToCss(0.6),
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)'
                    }}
                  >
                    {isSending ? (
                      <LoaderCircle size={18} className="animate-spin" />
                    ) : isRecordingVoice ? (
                      <Mic size={18} />
                    ) : (
                      <ArrowUp size={18} />
                    )}
                  </button>
                </div>
                {isRecordingVoice || isTranscribingVoice ? (
                  <div className="mt-2 text-[11px] normal-case text-white/60">
                    {isRecordingVoice ? 'J’écoute... appuie sur envoyer pour arrêter.' : 'Transcription en cours...'}
                  </div>
                ) : null}
              </form>
            </div>
          </div>
        </div>
      )}

      {previewState && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,10,12,0.7)] p-3 backdrop-blur-sm sm:p-6">
          <div className="w-full max-w-[760px] rounded-[24px] border border-white/8 bg-[#101216] p-4 sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-['Manrope'] uppercase tracking-[0.18em] text-white/42">
                  pre-ecoute integree
                </div>
                <div className="mt-1 font-['Syne'] text-[18px] font-bold normal-case text-white">
                  {previewState.candidate.title}
                </div>
                <div className="text-[12px] normal-case text-white/58">
                  {previewState.candidate.artist}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewState(null)}
                className="rounded-full border border-white/8 bg-white/6 p-2 text-white/70"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <span
                className="rounded-full border px-3 py-1.5 text-[10px] font-['Manrope'] uppercase tracking-[0.12em]"
                style={{
                  borderColor: rgbToCss(0.34),
                  backgroundColor: rgbToCss(0.14),
                  color: accentColor
                }}
              >
                {platformLabel(previewState.source.platform)}
              </span>
            </div>

            <div className="mb-3 flex items-center justify-between gap-3 rounded-[16px] border border-white/8 bg-white/4 px-3 py-2">
              <div className="min-w-0">
                <div className="text-[10px] font-['Manrope'] uppercase tracking-[0.12em] text-white/42">
                  source en lecture
                </div>
                <div className="mt-1 text-[12px] normal-case text-white/72">
                  {platformLabel(previewState.source.platform)} · lecteur intégré
                </div>
              </div>
              <a
                href={previewState.source.url}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-2 rounded-full border border-white/8 bg-white/6 px-3 py-2 text-[10px] font-['Manrope'] uppercase tracking-[0.12em] text-white/70"
              >
                <ExternalLink size={13} />
                ouvrir l'original
              </a>
            </div>

            <div className="overflow-hidden rounded-[20px] border border-white/8 bg-[#090b0e]">
              {resolvePreviewAudioUrl(previewState.source) ? (
                <div className="flex h-[240px] items-center justify-center px-4 sm:h-[300px]">
                  <audio
                    key={resolvePreviewAudioUrl(previewState.source)}
                    controls
                    autoPlay
                    preload="auto"
                    className="w-full max-w-[560px]"
                    src={resolvePreviewAudioUrl(previewState.source) ?? undefined}
                  />
                </div>
              ) : previewState.source.embed_url ? (
                <iframe
                  src={buildAutoplayEmbedUrl(previewState.source)}
                  title={`${previewState.candidate.title} pre-ecoute`}
                  className="h-[280px] w-full border-0 sm:h-[360px]"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  loading="eager"
                />
              ) : (
                <div className="flex h-[240px] flex-col items-center justify-center gap-3 px-6 text-center text-[13px] normal-case text-white/65">
                  <Play size={18} style={{ color: accentColor }} />
                  Cette source ne fournit pas de lecteur intégré. Essaie une autre source.
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleRejectCandidate(previewState.candidate.id)}
                className="flex items-center justify-center gap-2 rounded-[16px] border border-white/10 bg-white/6 px-4 py-3 text-[11px] font-['Manrope'] uppercase tracking-[0.12em] text-white/80"
              >
                <X size={15} />
                non, continue
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmCandidate(previewState.candidate.id)}
                className="flex items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-[11px] font-['Manrope'] uppercase tracking-[0.12em] text-white"
                style={{
                  background: `linear-gradient(135deg, ${rgbToCss(0.92)}, ${rgbToCss(0.72)})`
                }}
              >
                <Check size={15} />
                proposer a la playlist
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function buildFriendlySearchSteps(traces: SearchTrace[]) {
  const hasWeb = traces.some((trace) => trace.agent === 'agent-web')
  const hasCatalog =
    traces.some((trace) => trace.agent === 'agent-metadata') ||
    traces.some((trace) => trace.agent === 'agent-spotify') ||
    traces.some((trace) => trace.agent === 'agent-deezer') ||
    traces.some((trace) => trace.agent === 'agent-jamendo') ||
    traces.some((trace) => trace.agent === 'agent-audius') ||
    traces.some((trace) => trace.agent === 'agent-apple')
  const hasLyrics = traces.some((trace) => trace.agent === 'agent-lyrics')
  const hasAudio = traces.some((trace) => trace.agent === 'agent-audio')
  const hasContext = traces.some((trace) => trace.agent === 'agent-context')
  const hasLastfm = traces.some((trace) => trace.agent === 'agent-lastfm')

  return [
    hasWeb ? 'Je cherche sur YouTube et sur Internet.' : null,
    hasCatalog ? 'Je recoupe avec Spotify, SoundCloud, Deezer, Apple Music, Jamendo et Audius.' : null,
    hasLastfm ? 'Je compare aussi les titres similaires et les enchaînements probables.' : null,
    hasLyrics ? 'Je vérifie aussi les paroles si ça peut aider.' : null,
    hasAudio ? 'Je compare les versions pour garder le bon son.' : null,
    hasContext ? 'Je vérifie le contexte artiste pour confirmer.' : null
  ].filter(Boolean) as string[]
}

function formatPlayCount(playCount?: number) {
  if (!playCount) {
    return 'ecoutes n/a'
  }
  if (playCount >= 1_000_000_000) {
    return `${(playCount / 1_000_000_000).toFixed(1).replace('.0', '')}B ecoutes`
  }
  if (playCount >= 1_000_000) {
    return `${(playCount / 1_000_000).toFixed(1).replace('.0', '')}M ecoutes`
  }
  if (playCount >= 1_000) {
    return `${Math.round(playCount / 1_000)}K ecoutes`
  }
  return `${playCount} ecoutes`
}

function platformLabel(platform: string) {
  if (platform === 'youtube') return 'YouTube'
  if (platform === 'spotify') return 'Spotify'
  if (platform === 'soundcloud') return 'SoundCloud'
  if (platform === 'deezer') return 'Deezer'
  if (platform === 'apple_music') return 'Apple Music'
  if (platform === 'jamendo') return 'Jamendo'
  if (platform === 'audius') return 'Audius'
  return 'Web'
}

function resolveCandidateArtworkUrl(candidate: SearchCandidate, source?: TrackSource) {
  if (candidate.artwork_url) {
    return candidate.artwork_url
  }
  if (!source) {
    return null
  }
  if (source.platform === 'youtube' && source.external_id) {
    return `https://i.ytimg.com/vi/${source.external_id}/hqdefault.jpg`
  }
  return null
}

function toSingleSentence(text?: string) {
  if (!text) return 'Proposition musicale proche de la demande.'
  const compact = text.replace(/\s+/g, ' ').trim()
  const sentence = compact.split(/[.!?]/)[0]?.trim()
  return sentence ? `${sentence}.` : compact
}

function buildAutoplayEmbedUrl(source: TrackSource) {
  const url = source.embed_url ?? source.url
  if (!url) {
    return ''
  }

  const withParams = (params: Record<string, string>) => {
    try {
      const parsed = new URL(url)
      for (const [key, value] of Object.entries(params)) {
        parsed.searchParams.set(key, value)
      }
      return parsed.toString()
    } catch {
      const separator = url.includes('?') ? '&' : '?'
      const query = Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&')
      return `${url}${separator}${query}`
    }
  }

  if (source.platform === 'youtube') {
    return withParams({ autoplay: '1', playsinline: '1' })
  }
  if (source.platform === 'soundcloud') {
    return withParams({ auto_play: 'true', visual: 'true' })
  }
  if (source.platform === 'spotify') {
    return withParams({ autoplay: '1', utm_source: 'partyjam' })
  }
  if (source.platform === 'deezer') {
    return withParams({ autoplay: 'true' })
  }
  return url
}

function resolvePreviewAudioUrl(source: TrackSource) {
  const direct = source.preview_url ?? ''
  const lowered = direct.toLowerCase()
  if (lowered.includes('.mp3') || lowered.includes('.m4a') || lowered.includes('.aac') || lowered.includes('audio-ssl.itunes.apple.com')) {
    return direct
  }
  return null
}
