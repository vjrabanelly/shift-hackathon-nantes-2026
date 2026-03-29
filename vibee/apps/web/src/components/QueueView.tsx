
interface QueueTrack {
  id: string
  title: string
  artist: string
  cover_url: string | null
  position: number
  added_by: string
  added_by_display: string // guest "🎵 Alice" or "✨ AI Pick"
  file_path: string | null // null = still downloading
}

interface Props {
  tracks: QueueTrack[]
  onRemove?: (trackId: string) => void
  removingId?: string | null
  emptyTitle?: string
  emptySubtitle?: string
}


function SourceBadge({ addedBy, addedByDisplay }: { addedBy: string; addedByDisplay: string }) {
  if (addedBy === 'ai' || addedByDisplay.startsWith('✨')) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-300 flex-shrink-0">
        ✨ IA
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-white/50 flex-shrink-0 max-w-[72px] truncate">
      {addedByDisplay || '🎵 Invite'}
    </span>
  )
}

export function QueueView({ tracks, onRemove, removingId, emptyTitle, emptySubtitle }: Props) {
  if (tracks.length === 0) {
    return (
      <div className="text-center py-8 text-white/40">
        <p className="text-sm">{emptyTitle ?? 'La file est vide'}</p>
        <p className="text-xs mt-1">
          {emptySubtitle ?? 'Sois le premier a demander un son !'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {tracks.map((track, index) => (
        <div
          key={track.id}
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors"
        >
          {/* Position number */}
          <span className="text-white/30 text-sm w-6 text-right flex-shrink-0">
            {index + 1}
          </span>

          {/* Cover art thumbnail */}
          <div className="w-10 h-10 rounded flex-shrink-0 overflow-hidden">
            {track.cover_url ? (
              <img
                src={track.cover_url}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-800 to-blue-900 flex items-center justify-center">
                <span className="text-sm">🎵</span>
              </div>
            )}
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white text-sm font-medium truncate">
                {track.title}
              </p>
              {/* Loading indicator for tracks still downloading */}
              {!track.file_path && (
                <span className="text-yellow-400/60 text-xs flex-shrink-0">⏳</span>
              )}
            </div>
            <p className="text-white/50 text-xs truncate">{track.artist || 'Artiste inconnu'}</p>
          </div>

          {/* Source badge */}
          <SourceBadge addedBy={track.added_by} addedByDisplay={track.added_by_display} />

          {/* Remove button (admin only) */}
          {onRemove && (
            <button
                onClick={() => onRemove(track.id)}
                disabled={removingId === track.id}
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-white/10 transition-colors disabled:opacity-30 cursor-pointer"
                aria-label="Retirer le son"
              >
                {removingId === track.id ? (
                  <span className="text-xs animate-spin">⏳</span>
                ) : (
                  <span className="text-xs">✕</span>
                )}
              </button>
          )}
        </div>
      ))}
    </div>
  )
}
