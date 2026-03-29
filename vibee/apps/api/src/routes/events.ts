import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import crypto from 'crypto'
import fs from 'node:fs'
import { supabase } from '../lib/supabase'
import { computeCollective } from '../lib/compute-collective'
import { CreateEventRequest, CreateEventResponse, GetEventResponse, NowPlayingState, QueuedTrack } from '@partyjam/shared'
import { StreamManager } from '../services/stream-manager'
import { QueueEngine } from '../services/queue-engine'
import { TrackResolver } from '../services/track-resolver'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'
const STREAM_BASE_URL = process.env.STREAM_BASE_URL

function buildStreamUrl(request: FastifyRequest, eventId: string): string {
  const origin = STREAM_BASE_URL ?? `${request.protocol}://${request.headers.host ?? 'localhost:3000'}`
  return `${origin}/stream/${eventId}/playlist.m3u8`
}

export async function eventsRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateEventRequest }>(
    '/',
    async (request: FastifyRequest<{ Body: CreateEventRequest }>, reply: FastifyReply) => {
      const body = request.body

      if (!body.name || body.name.trim() === '') {
        return reply.status(400).send({ error: 'name is required' })
      }

      const adminToken = 'tok_' + crypto.randomBytes(16).toString('hex')

      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          name: body.name.trim(),
          admin_token: adminToken,
          vibe_config: body.vibe_config ?? {},
          seed_playlist: body.seed_playlist ?? [],
        })
        .select()
        .single()

      if (eventError || !event) {
        app.log.error(eventError)
        return reply.status(500).send({ error: 'Failed to create event' })
      }

      if (body.seed_playlist && body.seed_playlist.length > 0) {
        const tracks = body.seed_playlist.map((track, index) => ({
          event_id: event.id,
          title: track.title,
          artist: track.artist,
          youtube_id: track.youtube_id ?? null,
          added_by: 'admin',
          status: 'queued',
          position: index,
        }))

        const { data: insertedTracks, error: tracksError } = await supabase
          .from('tracks')
          .insert(tracks)
          .select()

        if (tracksError) {
          app.log.error(tracksError)
          // Don't fail the request, event was created
        } else {
          for (const track of insertedTracks ?? []) {
            TrackResolver.hydrateQueuedTrack({
              eventId: event.id,
              trackId: track.id,
              title: track.title,
              artist: track.artist,
              youtubeId: track.youtube_id ?? null,
            }).catch((error) => {
              app.log.error({ err: error }, `[events] Seed track hydration failed for ${track.id}`)
            })
          }
        }
      }

      const joinUrl = `${BASE_URL}/join/${event.id}`
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(joinUrl)}&size=300x300`
      const streamUrl = buildStreamUrl(request, event.id)

      const response: CreateEventResponse = {
        event_id: event.id,
        admin_token: adminToken,
        join_url: joinUrl,
        qr_url: qrUrl,
        stream_url: streamUrl,
      }

      return reply.status(201).send(response)
    }
  )

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { id } = req.params

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single()

    if (eventError || !event) {
      return reply.code(404).send({ error: 'Event not found' })
    }

    const playingTrack = await ensureNowPlayingTrack(id)

    let now_playing: NowPlayingState | null = null
    if (playingTrack) {
      const startedAt = playingTrack.started_at ?? playingTrack.created_at
      const elapsedSeconds = (Date.now() - new Date(startedAt).getTime()) / 1000
      now_playing = {
        track: playingTrack,
        started_at: startedAt,
        elapsed_seconds: Math.max(0, elapsedSeconds),
      }
    }

    const { data: queuedTracks } = await supabase
      .from('tracks')
      .select('*')
      .eq('event_id', id)
      .eq('status', 'queued')
      .neq('added_by', 'ai')
      .order('position', { ascending: true })

    const guestIds = (queuedTracks ?? [])
      .map((t) => t.added_by)
      .filter((id) => id && id !== 'ai')

    const { data: guests } = guestIds.length > 0
      ? await supabase
          .from('guests')
          .select('id, display_name, emoji')
          .in('id', guestIds)
      : { data: [] }

    const guestMap = new Map(
      (guests ?? []).map((g) => [g.id, `${g.emoji ?? '🎵'} ${g.display_name}`])
    )

    const queue: QueuedTrack[] = (queuedTracks ?? []).map((track) => ({
      track,
      position: track.position,
      added_by_display:
        track.added_by === 'ai'
          ? '🤖 IA'
          : (guestMap.get(track.added_by) ?? '🎵 Invite'),
    }))

    const { count: guest_count } = await supabase
      .from('guests')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id)

    const { data: joystickPositions } = await supabase
      .from('joystick_positions')
      .select('valence, energy')
      .eq('event_id', id)

    const collective_joystick = computeCollective(joystickPositions ?? [])

    const { data: playedTracks } = await supabase
      .from('tracks')
      .select('*')
      .eq('event_id', id)
      .eq('status', 'played')
      .order('started_at', { ascending: false })
      .limit(20)

    const history: QueuedTrack[] = (playedTracks ?? []).map((track) => ({
      track,
      position: track.position,
      added_by_display:
        track.added_by === 'ai'
          ? '🤖 IA'
          : (guestMap.get(track.added_by) ?? '🎵 Invite'),
    }))

    const streamUrl = buildStreamUrl(req, event.id)
    const response: GetEventResponse = {
      event: {
        ...event,
        stream_url: streamUrl,
      },
      now_playing,
      queue,
      history,
      guest_count: guest_count ?? 0,
      collective_joystick,
    }

    return reply.send(response)
  })

  app.get<{ Params: { id: string } }>('/:id/now-playing/audio', async (req, reply) => {
    const { id: eventId } = req.params

    const playingTrack = await ensureNowPlayingTrack(eventId)

    const filePath = playingTrack?.file_path
    if (!filePath || !fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'No playable track found' })
    }

    const stat = fs.statSync(filePath)
    const range = req.headers.range

    if (!range) {
      reply.header('Content-Type', 'audio/mpeg')
      reply.header('Content-Length', stat.size)
      reply.header('Accept-Ranges', 'bytes')
      return reply.send(fs.createReadStream(filePath))
    }

    const [startToken, endToken] = range.replace(/bytes=/, '').split('-')
    const start = Number.parseInt(startToken, 10)
    const end = endToken ? Number.parseInt(endToken, 10) : stat.size - 1

    if (!Number.isFinite(start) || start < 0 || start >= stat.size || end < start) {
      return reply.status(416).send({ error: 'Invalid range' })
    }

    reply.code(206)
    reply.header('Content-Type', 'audio/mpeg')
    reply.header('Accept-Ranges', 'bytes')
    reply.header('Content-Length', end - start + 1)
    reply.header('Content-Range', `bytes ${start}-${end}/${stat.size}`)
    return reply.send(fs.createReadStream(filePath, { start, end }))
  })

  // POST /events/:id/skip — admin skips current track
  app.post<{
    Params: { id: string }
    Headers: { 'x-admin-token'?: string }
  }>('/:id/skip', async (req, reply) => {
    const { id: eventId } = req.params
    const adminToken = req.headers['x-admin-token']

    const { data: event } = await supabase
      .from('events')
      .select('id, admin_token')
      .eq('id', eventId)
      .single()

    if (!event) {
      return reply.status(404).send({ error: 'Event not found' })
    }

    if (event.admin_token !== adminToken) {
      return reply.status(403).send({ error: 'Invalid admin token' })
    }

    const streamManager = StreamManager.getInstance()
    await streamManager.advanceTrackInDb(eventId)
    streamManager.syncEventStream(eventId).catch(() => {})

    const { data: nowPlaying } = await supabase
      .from('tracks')
      .select('id, title, artist, cover_url, youtube_id')
      .eq('event_id', eventId)
      .eq('status', 'playing')
      .single()

    return reply.status(200).send({ now_playing: nowPlaying ?? null })
  })

  // POST /events/:id/history/replay — move all played tracks back to queue
  app.post<{
    Params: { id: string }
    Headers: { 'x-admin-token'?: string }
  }>('/:id/history/replay', async (req, reply) => {
    const { id: eventId } = req.params
    const adminToken = req.headers['x-admin-token']

    const { data: event } = await supabase
      .from('events')
      .select('id, admin_token')
      .eq('id', eventId)
      .single()

    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (event.admin_token !== adminToken) return reply.status(403).send({ error: 'Invalid admin token' })

    const { data: playedTracks } = await supabase
      .from('tracks')
      .select('id')
      .eq('event_id', eventId)
      .eq('status', 'played')
      .order('started_at', { ascending: true })

    if (!playedTracks || playedTracks.length === 0) {
      return reply.status(200).send({ restored: 0 })
    }

    const { data: lastQueued } = await supabase
      .from('tracks')
      .select('position')
      .eq('event_id', eventId)
      .eq('status', 'queued')
      .order('position', { ascending: false })
      .limit(1)

    const startPosition = (lastQueued?.[0]?.position ?? 0) + 1

    for (let i = 0; i < playedTracks.length; i++) {
      await supabase
        .from('tracks')
        .update({ status: 'queued', started_at: null, position: startPosition + i })
        .eq('id', playedTracks[i].id)
    }

    return reply.status(200).send({ restored: playedTracks.length })
  })

  // DELETE /events/:id/tracks/:trackId — admin removes a track from queue
  app.delete<{
    Params: { id: string; trackId: string }
    Headers: { 'x-admin-token'?: string }
  }>('/:id/tracks/:trackId', async (req, reply) => {
    const { id: eventId, trackId } = req.params
    const adminToken = req.headers['x-admin-token']

    const { data: event } = await supabase
      .from('events')
      .select('id, admin_token')
      .eq('id', eventId)
      .single()

    if (!event) {
      return reply.status(404).send({ error: 'Event not found' })
    }

    if (event.admin_token !== adminToken) {
      return reply.status(403).send({ error: 'Invalid admin token' })
    }

    const { data: track } = await supabase
      .from('tracks')
      .select('id, status')
      .eq('id', trackId)
      .eq('event_id', eventId)
      .single()

    if (!track) {
      return reply.status(404).send({ error: 'Track not found' })
    }

    if (track.status !== 'queued') {
      return reply.status(400).send({ error: 'Can only remove queued tracks' })
    }

    const { error } = await supabase
      .from('tracks')
      .delete()
      .eq('id', trackId)
      .eq('event_id', eventId)

    if (error) {
      app.log.error(error)
      return reply.status(500).send({ error: 'Failed to remove track' })
    }

    await StreamManager.getInstance().syncEventStream(eventId)

    return reply.status(200).send({ success: true })
  })
}

async function ensureNowPlayingTrack(eventId: string) {
  const { data: currentPlaying } = await supabase
    .from('tracks')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'playing')
    .neq('added_by', 'ai')
    .order('started_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (currentPlaying?.file_path) {
    return currentPlaying
  }

  if (currentPlaying) {
    await supabase
      .from('tracks')
      .update({ status: 'queued', started_at: null })
      .eq('id', currentPlaying.id)
  }

  const { data: nextQueued } = await supabase
    .from('tracks')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'queued')
    .neq('added_by', 'ai')
    .not('file_path', 'is', null)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!nextQueued) {
    return null
  }

  const startedAt = new Date().toISOString()
  await supabase
    .from('tracks')
    .update({ status: 'playing', started_at: startedAt })
    .eq('id', nextQueued.id)

  return {
    ...nextQueued,
    status: 'playing',
    started_at: startedAt,
  }
}
