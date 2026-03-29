import { useEffect, useState } from 'react'

const cssToRgba = (color: string, alpha: number) => {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`
  return color
}

interface Props {
  /** Track title to display (editable in prototype mode) */
  trackName?: string
  /** Artist / subtitle */
  artist?: string
  /** Cover image URL */
  coverUrl?: string
  /** Duration in seconds */
  durationSeconds?: number
  /** Elapsed seconds (auto-ticks if not provided) */
  elapsedSeconds?: number
  /** CSS color string for progress bar */
  accentColor?: string
  /** Whether the track is currently playing */
  isPlaying?: boolean
}

export function NowPlayingCard({
  trackName: initialTrackName = 'Nom du morceau',
  artist,
  coverUrl = 'https://picsum.photos/seed/shift-vibee-cover/320/320',
  durationSeconds = 240,
  elapsedSeconds: elapsedProp,
  accentColor = '#3FE08A',
  isPlaying = true,
}: Props) {
  const [trackName, setTrackName] = useState(initialTrackName)
  const [playbackSeconds, setPlaybackSeconds] = useState(
    isPlaying ? (elapsedProp ?? 0) : 0
  )

  // Keep name in sync with prop changes (e.g. real track loaded later)
  useEffect(() => {
    setTrackName(initialTrackName)
  }, [initialTrackName])

  // If elapsedSeconds is controlled, sync it
  useEffect(() => {
    if (elapsedProp !== undefined) setPlaybackSeconds(elapsedProp)
  }, [elapsedProp])

  // Auto-tick when uncontrolled
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
            {/* Vinyl grooves overlay */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `
                  repeating-radial-gradient(circle at center, rgba(255,255,255,0.06) 0 1px, transparent 2px 10px),
                  radial-gradient(circle at center, transparent 0 8%, rgba(8,8,10,0.82) 9% 12%, transparent 13% 100%)
                `,
              }}
            />
            {/* Center hole */}
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
          {artist && (
            <p className="mt-0.5 truncate text-[11px] text-white/50">{artist}</p>
          )}
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
