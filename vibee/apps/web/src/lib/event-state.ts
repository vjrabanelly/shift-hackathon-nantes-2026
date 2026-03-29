export interface ViewTrack {
  id: string
  title: string
  artist: string
  cover_url: string | null
  duration: number | null
  status: 'queued' | 'playing' | 'played' | 'removed'
  position: number
  added_by: string
  added_by_display: string
  file_path: string | null
  elapsed_seconds?: number
}

export interface ViewEventState {
  event: {
    id: string
    name: string
    stream_url?: string
    qr_code_url?: string
  }
  nowPlaying: ViewTrack | null
  queue: ViewTrack[]
  history: ViewTrack[]
  guestCount: number
  collectiveJoystick: { valence: number; energy: number }
  now_playing: ViewTrack | null
  tracks: ViewTrack[]
  guests_count: number
  collective_joystick: { valence: number; energy: number }
}

export function normalizeNowPlaying(input: any): ViewTrack | null {
  if (!input) {
    return null
  }

  const track = 'track' in input ? input.track : input
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    cover_url: track.cover_url ?? null,
    duration: track.duration ?? null,
    status: (track.status ?? 'playing') as ViewTrack['status'],
    position: track.position ?? 0,
    added_by: track.added_by ?? '',
    added_by_display: track.added_by_display ?? '',
    file_path: track.file_path ?? null,
    elapsed_seconds:
      typeof input.elapsed_seconds === 'number'
        ? input.elapsed_seconds
        : (track.elapsed_seconds ?? 0),
  }
}

export function normalizeQueuedTrack(input: any): ViewTrack {
  const track = 'track' in input ? input.track : input
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    cover_url: track.cover_url ?? null,
    duration: track.duration ?? null,
    status: (track.status ?? 'queued') as ViewTrack['status'],
    position: input.position ?? track.position ?? 0,
    added_by: track.added_by ?? '',
    added_by_display: input.added_by_display ?? track.added_by_display ?? '',
    file_path: track.file_path ?? null,
    elapsed_seconds: track.elapsed_seconds,
  }
}

export function normalizeEventResponse(payload: any): ViewEventState {
  const rawQueue = Array.isArray(payload?.queue)
    ? payload.queue
    : Array.isArray(payload?.tracks)
      ? payload.tracks
      : []
  const normalizedQueue = rawQueue.map(normalizeQueuedTrack)
  const normalizedHistory = Array.isArray(payload?.history)
    ? payload.history.map(normalizeQueuedTrack)
    : []
  const nowPlaying = normalizeNowPlaying(payload?.now_playing)
  const guestCount = payload?.guest_count ?? payload?.guests_count ?? 0
  const collectiveJoystick = payload?.collective_joystick ?? { valence: 0, energy: 0 }

  return {
    event: {
      id: payload?.event?.id ?? '',
      name: payload?.event?.name ?? 'Party JAM',
      stream_url: payload?.event?.stream_url ?? payload?.stream_url,
      qr_code_url: payload?.event?.qr_code_url,
    },
    nowPlaying,
    queue: normalizedQueue,
    history: normalizedHistory,
    guestCount,
    collectiveJoystick,
    now_playing: nowPlaying,
    tracks: normalizedQueue,
    guests_count: guestCount,
    collective_joystick: collectiveJoystick,
  }
}
