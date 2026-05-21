import { useEffect, useState } from 'react'
import { toCamelotCode } from '../lib/camelot'

const cssToRgba = (color: string, alpha: number) => {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`
  return color
}

interface Props {
  trackName?: string
  artist?: string
  coverUrl?: string
  durationSeconds?: number
  elapsedSeconds?: number
  accentColor?: string
  isPlaying?: boolean
  bpm?: number | null
  musicalKey?: string | null
}

export function NowPlayingCard({
  trackName: initialTrackName = 'Nom du morceau',
  artist,
  coverUrl = 'https://picsum.photos/seed/shift-vibee-cover/320/320',
  durationSeconds = 240,
  elapsedSeconds: elapsedProp,
  accentColor = '#3FE08A',
  isPlaying = true,
  bpm,
  musicalKey,
}: Props) {
  const [trackName, setTrackName] = useState(initialTrackName)
  const [playbackSeconds, setPlaybackSeconds] = useState(
    isPlaying ? (elapsedProp ?? 0) : 0
  )

  useEffect(() => {
    setTrackName(initialTrackName)
  }, [initialTrackName])

  useEffect(() => {
    if (elapsedProp !== undefined) setPlaybackSeconds(elapsedProp)
  }, [elapsedProp])

  useEffect(() => {
    if (!isPlaying || elapsedProp !== undefined) return
    const intervalId = window.setInterval(() => {
      setPlaybackSeconds((prev) => (prev + 1) % durationSeconds)
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [durationSeconds, elapsedProp, isPlaying])

  useEffect(() => {
    if (!isPlaying) {
      setPlaybackSeconds(0)
    }
  }, [isPlaying])

  const formatTime = (totalSeconds: number) => {
    const rounded = Math.max(0, Math.floor(totalSeconds))
    const minutes = Math.floor(rounded / 60)
    const seconds = rounded % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  const camelotCode = toCamelotCode(musicalKey)

  return (
    <div className="p-2.5 transition-all duration-700" style={{ background: 'transparent' }}>
      <div className="flex items-center gap-2.5">
        {/* Spinning vinyl disc */}
        <div
          className="relative shrink-0"
          style={{
            width: 'clamp(58px, 18vw, 86px)',
            height: 'clamp(58px, 18vw, 86px)',
          }}
        >
          <div
            className="relative h-full w-full overflow-hidden rounded-full"
            style={{
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              animation: isPlaying ? 'vinyl-spin 5.8s linear infinite' : 'none',
            }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `
                  repeating-radial-gradient(circle at center, rgba(255,255,255,0.06) 0 1px, transparent 2px 10px),
                  radial-gradient(circle at center, transparent 0 8%, rgba(8,8,10,0.82) 9% 12%, transparent 13% 100%)
                `,
              }}
            />
            <div className="absolute inset-[45%] rounded-full bg-[#111215]" />
          </div>
        </div>

        {/* Track info */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[10px] font-['Manrope'] uppercase tracking-[0.16em] text-white/46">en cours de lecture</div>
          <input
            value={trackName}
            onChange={(event) => setTrackName(event.target.value)}
            className="w-full bg-transparent font-['Bebas_Neue'] font-bold normal-case text-white outline-none placeholder:text-white/28"
            style={{ fontSize: 'clamp(16px, 4.2vw, 21px)' }}
            placeholder="Nom du morceau"
          />
          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
            {artist && (
              <p className="truncate text-[11px] text-white/50">{artist}</p>
            )}
            {(bpm || camelotCode) && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {bpm && (
                  <span className="text-[9px] font-['Space_Mono'] tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }}>
                    {Math.round(bpm)} BPM
                  </span>
                )}
                {camelotCode && (
                  <span className="text-[9px] font-['Space_Mono'] tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }}>
                    {camelotCode}
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Time display */}
          <div className="mt-1 flex justify-between text-[10px] font-['Manrope'] uppercase tracking-[0.14em] text-white/52">
            <span>{formatTime(playbackSeconds)}</span>
            <span>{formatTime(durationSeconds)}</span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-[6px] overflow-hidden rounded-full border" style={{ background: 'rgba(255,255,255,0.045)', borderColor: 'rgba(255,255,255,0.03)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${isPlaying ? Math.max(8, (playbackSeconds / durationSeconds) * 100) : 0}%`,
                background: `linear-gradient(90deg, ${cssToRgba(accentColor, 0.7)}, ${accentColor})`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
