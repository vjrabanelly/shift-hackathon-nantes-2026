import { FastifyPluginAsync } from 'fastify'
import type {
  AgentSession,
  ConfirmAgentCandidateResponse,
  CreateAgentTurnRequest,
  CreateAgentTurnResponse,
  GetAgentSessionResponse,
  NowPlayingState,
  QueuedTrack,
  ResetAgentSessionRequest,
  ResetAgentSessionResponse,
  SearchCandidate,
  Track,
  TrackSource
} from '@partyjam/shared'
import { supabase } from '../lib/supabase'
import { createAgentTurn, rejectCandidate, selectCandidatePreview, confirmCandidate } from '../music-agent'
import { PartyStore } from '../store'
import { TrackResolver } from '../services/track-resolver'

const agentStore = new PartyStore()

interface EventSnapshot {
  event: any
  guest: any | null
  nowPlaying: NowPlayingState | null
  queue: QueuedTrack[]
  queueTracks: Track[]
  collective: { valence: number; energy: number }
}

export const agentRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Params: { id: string }
    Querystring: { guest_id?: string }
  }>('/:id/agent/session', async (req, reply) => {
    const { id: eventId } = req.params
    const guestId = req.query.guest_id

    if (!guestId) {
      return reply.status(400).send({ error: 'guest_id is required' })
    }

    const snapshot = await loadEventSnapshot(eventId, guestId)
    if (!snapshot) {
      return reply.status(404).send({ error: 'Event not found' })
    }

    hydrateStore(snapshot)
    const session = agentStore.getSession(eventId, guestId)

    const response: GetAgentSessionResponse = {
      session,
      now_playing: snapshot.nowPlaying,
      queue: snapshot.queue
    }

    return reply.send(response)
  })

  app.post<{
    Params: { id: string }
    Body: ResetAgentSessionRequest
  }>('/:id/agent/session/reset', async (req, reply) => {
    const { id: eventId } = req.params
    const { guest_id } = req.body

    const snapshot = await loadEventSnapshot(eventId, guest_id)
    if (!snapshot) {
      return reply.status(404).send({ error: 'Event not found' })
    }

    hydrateStore(snapshot)
    const session = agentStore.resetSession(eventId, guest_id)

    const response: ResetAgentSessionResponse = {
      session
    }

    return reply.send(response)
  })

  app.post<{
    Params: { id: string }
    Body: CreateAgentTurnRequest
  }>('/:id/agent/turns', async (req, reply) => {
    const { id: eventId } = req.params
    const { guest_id, message, joystick } = req.body

    const snapshot = await loadEventSnapshot(eventId, guest_id)
    if (!snapshot) {
      return reply.status(404).send({ error: 'Event not found' })
    }

    hydrateStore(snapshot)
    const result = await createAgentTurn(agentStore, eventId, guest_id, message, joystick)

    const response: CreateAgentTurnResponse = {
      session: result.session
    }

    return reply.send(response)
  })

  app.post<{
    Params: { id: string; candidateId: string }
    Body: { guest_id: string; source_id: string }
  }>('/:id/agent/candidates/:candidateId/preview/select', async (req, reply) => {
    const { id: eventId, candidateId } = req.params
    const { guest_id, source_id } = req.body

    const snapshot = await loadEventSnapshot(eventId, guest_id)
    if (!snapshot) {
      return reply.status(404).send({ error: 'Event not found' })
    }

    hydrateStore(snapshot)
    const selection = selectCandidatePreview(agentStore, eventId, guest_id, candidateId, source_id)

    return reply.send({
      session: selection.session,
      candidate: selection.candidate,
      selected_source: selection.selected_source
    })
  })

  app.post<{
    Params: { id: string; candidateId: string }
    Body: { guest_id: string }
  }>('/:id/agent/candidates/:candidateId/reject', async (req, reply) => {
    const { id: eventId, candidateId } = req.params
    const { guest_id } = req.body

    const snapshot = await loadEventSnapshot(eventId, guest_id)
    if (!snapshot) {
      return reply.status(404).send({ error: 'Event not found' })
    }

    hydrateStore(snapshot)
    const result = await rejectCandidate(agentStore, eventId, guest_id, candidateId)

    return reply.send({
      session: result.session
    })
  })

  app.post<{
    Params: { id: string; candidateId: string }
    Body: { guest_id: string }
  }>('/:id/agent/candidates/:candidateId/confirm', async (req, reply) => {
    const { id: eventId, candidateId } = req.params
    const { guest_id } = req.body

    const snapshot = await loadEventSnapshot(eventId, guest_id)
    if (!snapshot) {
      return reply.status(404).send({ error: 'Event not found' })
    }

    hydrateStore(snapshot)
    const result = confirmCandidate(agentStore, eventId, guest_id, candidateId)

    if (!snapshot.queueTracks.some((track) => track.id === result.track.id)) {
      const insertPayload = mapTrackForInsert(result.track)
      const { error } = await supabase.from('tracks').insert(insertPayload)
      if (error) {
        app.log.error(error, 'Failed to insert confirmed agent track')
        return reply.status(500).send({ error: 'Failed to add track to queue' })
      }

      const hydrated = await TrackResolver.hydrateQueuedTrack({
        eventId,
        trackId: result.track.id,
        title: result.track.title,
        artist: result.track.artist,
        youtubeId: result.track.youtube_id ?? null,
      })

      if (!hydrated) {
        app.log.warn({ trackId: result.track.id }, 'Confirmed agent track is not playable yet')
      }
    }

    const refreshed = await loadEventSnapshot(eventId, guest_id)
    if (!refreshed) {
      return reply.status(404).send({ error: 'Event not found after confirmation' })
    }

    hydrateStore(refreshed)

    const response: ConfirmAgentCandidateResponse = {
      session: result.session,
      queue: refreshed.queue
    }

    return reply.send(response)
  })
}

function hydrateStore(snapshot: EventSnapshot) {
  agentStore.hydrateEventContext({
    event: snapshot.event,
    guest: snapshot.guest,
    tracks: [
      ...(snapshot.nowPlaying ? [snapshot.nowPlaying.track] : []),
      ...snapshot.queueTracks
    ],
    collective: snapshot.collective
  })
}

async function loadEventSnapshot(eventId: string, guestId: string): Promise<EventSnapshot | null> {
  const [{ data: event }, { data: guest }] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).single(),
    supabase.from('guests').select('*').eq('id', guestId).eq('event_id', eventId).maybeSingle()
  ])

  if (!event) {
    return null
  }

  const [{ data: playingTrack }, { data: queuedTracks }, { data: guests }, { data: joystickPositions }] =
    await Promise.all([
      supabase.from('tracks').select('*').eq('event_id', eventId).eq('status', 'playing').maybeSingle(),
      supabase.from('tracks').select('*').eq('event_id', eventId).eq('status', 'queued').order('position', { ascending: true }),
      supabase.from('guests').select('id, display_name, emoji').eq('event_id', eventId),
      supabase.from('joystick_positions').select('valence, energy').eq('event_id', eventId)
    ])

  const guestMap = new Map((guests ?? []).map((entry) => [entry.id, `${entry.emoji} ${entry.display_name}`]))

  const nowPlaying: NowPlayingState | null = playingTrack
    ? {
        track: normalizeTrack(playingTrack),
        started_at: playingTrack.started_at ?? playingTrack.created_at,
        elapsed_seconds: Math.max(0, (Date.now() - new Date(playingTrack.started_at ?? playingTrack.created_at).getTime()) / 1000)
      }
    : null

  const queueTracks = (queuedTracks ?? []).map(normalizeTrack)
  const queue: QueuedTrack[] = queueTracks.map((track) => ({
    track,
    position: track.position,
    added_by_display:
      track.added_by === 'ai'
        ? '🤖 IA'
        : guestMap.get(track.added_by) ?? track.added_by
  }))

  const collective = computeCollective(joystickPositions ?? [])

  return {
    event,
    guest,
    nowPlaying,
    queue,
    queueTracks,
    collective
  }
}

function computeCollective(positions: Array<{ valence: number; energy: number }>) {
  if (positions.length === 0) {
    return { valence: 0, energy: 0 }
  }

  const totals = positions.reduce(
    (accumulator, current) => ({
      valence: accumulator.valence + current.valence,
      energy: accumulator.energy + current.energy
    }),
    { valence: 0, energy: 0 }
  )

  return {
    valence: Number((totals.valence / positions.length).toFixed(2)),
    energy: Number((totals.energy / positions.length).toFixed(2))
  }
}

function normalizeTrack(track: any): Track {
  return {
    ...track,
    primary_source: inferPrimarySource(track),
    linked_sources: inferLinkedSources(track),
    audio_metrics: track.audio_metrics ?? null
  }
}

function inferPrimarySource(track: any): TrackSource | undefined {
  if (track.primary_source) {
    return track.primary_source
  }

  if (track.youtube_id) {
    return {
      id: `youtube:${track.youtube_id}`,
      platform: 'youtube',
      external_id: track.youtube_id,
      url: `https://www.youtube.com/watch?v=${track.youtube_id}`,
      embed_url: `https://www.youtube.com/embed/${track.youtube_id}`,
      preview_url: `https://www.youtube.com/embed/${track.youtube_id}`,
      label: `${track.artist} — ${track.title}`,
      playable: true
    }
  }

  return undefined
}

function inferLinkedSources(track: any): TrackSource[] | undefined {
  if (Array.isArray(track.linked_sources) && track.linked_sources.length > 0) {
    return track.linked_sources
  }

  const primary = inferPrimarySource(track)
  return primary ? [primary] : undefined
}

function mapTrackForInsert(track: Track) {
  return {
    id: track.id,
    event_id: track.event_id,
    title: track.title,
    artist: track.artist,
    duration: track.duration ?? null,
    youtube_id:
      track.youtube_id ??
      (track.primary_source?.platform === 'youtube' ? track.primary_source.external_id : null),
    cover_url: track.cover_url ?? null,
    essentia_features: track.essentia_features ?? null,
    added_by: track.added_by,
    status: track.status,
    position: track.position,
    started_at: track.started_at ?? null,
    created_at: track.created_at
  }
}

