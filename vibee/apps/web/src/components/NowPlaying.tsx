import { useEffect, useState } from 'react'

interface NowPlayingTrack {
  id: string
  title: string
  artist: string
  cover_url: string | null
  duration: number | null       // seconds
  elapsed_seconds: number       // seconds since track started
}

interface Props {
  nowPlaying: NowPlayingTrack | null
  audioUrl?: string
}

export function NowPlaying({ nowPlaying, audioUrl }: Props) {
  const [elapsed, setElapsed] = useState(nowPlaying?.elapsed_seconds ?? 0)

  // Reset elapsed when track changes
  useEffect(() => {
    setElapsed(nowPlaying?.elapsed_seconds ?? 0)
  }, [nowPlaying?.id])

  // Tick every second
  useEffect(() => {
    if (!nowPlaying) return
    const interval = setInterval(() => {
      setElapsed((e) => e + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [nowPlaying?.id])

  if (!nowPlaying) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-white/40">
        <div className="text-5xl mb-4">🎵</div>
        <p className="text-lg">Nothing playing yet</p>
        <p className="text-sm mt-1">Request a song below!</p>
      </div>
    )
  }

  const duration = nowPlaying.duration ?? 0
  const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 0
  const progressPercent = `${(progress * 100).toFixed(1)}%`

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Cover Art */}
      <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0">
        {nowPlaying.cover_url ? (
          <img
            src={nowPlaying.cover_url}
            alt={`${nowPlaying.title} cover art`}
            className="w-full h-full object-cover"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-800 to-blue-900 flex items-center justify-center">
            <span className="text-6xl">🎵</span>
          </div>
        )}
      </div>

      {/* Track Info */}
      <div className="text-center px-4">
        <h2 className="text-white text-xl font-bold truncate max-w-xs">{nowPlaying.title}</h2>
        <p className="text-white/60 text-sm mt-1 truncate max-w-xs">{nowPlaying.artist || 'Unknown Artist'}</p>
      </div>

      {/* Progress Bar or Audio Player */}
      {audioUrl ? (
        <div className="w-full max-w-xs px-4">
          <audio
            key={nowPlaying.id}
            className="w-full"
            controls
            autoPlay
            preload="metadata"
            src={audioUrl}
          />
        </div>
      ) : (
        <div className="w-full max-w-xs px-4">
          <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-1000"
              style={{ width: progressPercent }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/40 mt-1">
            <span>{formatTime(elapsed)}</span>
            <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
          </div>
        </div>
      )}
    </div>
  )
}
