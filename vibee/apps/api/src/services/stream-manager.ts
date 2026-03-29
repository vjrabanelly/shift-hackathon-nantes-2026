import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { Track } from '@partyjam/shared'
import { getEventPlaylistPath, getEventStreamDir, HLS_ROOT_DIR, TRANSITIONS_DIR } from '../lib/media-paths'
import { isPlayableAudioFile } from '../lib/ytdlp'
import { supabase } from '../lib/supabase'
import { PlannedTransition, TransitionPlanner } from './transition-planner'

const STREAM_TRACK_FIELDS =
  'id, event_id, title, artist, duration, youtube_id, file_path, cover_url, status, position, started_at, created_at'
const MAX_STREAM_TRACKS = 4

type StreamTrack = Pick<
  Track,
  | 'id'
  | 'event_id'
  | 'title'
  | 'artist'
  | 'duration'
  | 'youtube_id'
  | 'file_path'
  | 'cover_url'
  | 'status'
  | 'position'
  | 'started_at'
  | 'created_at'
>

interface TimelineInput {
  kind: 'track' | 'transition'
  path: string
  trimStart?: number
  trimEnd?: number
}

interface EventStreamState {
  ffmpegProcess: ChildProcess | null
  buildQueue: Promise<void>
}

export class StreamManager {
  private static instance: StreamManager
  private readonly eventStates = new Map<string, EventStreamState>()
  private readonly transitionPlanner = new TransitionPlanner()

  static getInstance(): StreamManager {
    if (!StreamManager.instance) {
      StreamManager.instance = new StreamManager()
    }
    return StreamManager.instance
  }

  init(): void {
    fs.mkdirSync(HLS_ROOT_DIR, { recursive: true })
    fs.mkdirSync(TRANSITIONS_DIR, { recursive: true })
  }

  getStreamUrl(eventId: string): string {
    return `/stream/${eventId}/playlist.m3u8`
  }

  async startStream(eventId: string): Promise<void> {
    await this.syncEventStream(eventId)
  }

  buildAcrossfadeFilter(trackCount: number): string {
    if (trackCount === 1) {
      return '[0:a]anull[out]'
    }
    if (trackCount === 2) {
      return '[0:a][1:a]acrossfade=d=3:c1=tri:c2=tri[out]'
    }

    let filter = '[0:a][1:a]acrossfade=d=3:c1=tri:c2=tri[a01]'
    let previous = 'a01'
    for (let index = 2; index < trackCount; index++) {
      const next = index === trackCount - 1 ? 'out' : `a0${index}`
      filter += `;[${previous}][${index}:a]acrossfade=d=3:c1=tri:c2=tri[${next}]`
      previous = next
    }
    return filter
  }

  async syncEventStream(eventId: string): Promise<void> {
    const state = this.getEventState(eventId)
    const nextBuild = state.buildQueue
      .catch(() => undefined)
      .then(async () => {
        await this.syncEventStreamInternal(eventId)
      })

    state.buildQueue = nextBuild
    return nextBuild
  }

  async advanceToNextTrack(eventId: string): Promise<void> {
    await this.advanceTrackInDb(eventId)
    await this.syncEventStream(eventId)
  }

  async advanceTrackInDb(eventId: string): Promise<void> {
    const currentTrack = await this.getPlayingTrack(eventId)
    if (currentTrack) {
      await supabase
        .from('tracks')
        .update({ status: 'played' })
        .eq('id', currentTrack.id)
    }

    await this.promoteFirstQueuedTrack(eventId)
  }

  buildTimelineInputs(
    tracks: StreamTrack[],
    transitions: Array<PlannedTransition | null>
  ): TimelineInput[] {
    const inputs: TimelineInput[] = []

    tracks.forEach((track, index) => {
      if (!track.file_path) {
        return
      }

      const previousTransition = index > 0 ? transitions[index - 1] : null
      const nextTransition = index < transitions.length ? transitions[index] : null
      const trimStart = previousTransition
        ? this.normalizeTime(previousTransition.targetWindow.end)
        : undefined
      const trimEnd = nextTransition
        ? this.normalizeTime(nextTransition.sourceWindow.start)
        : undefined

      if (this.hasTrackBody(trimStart, trimEnd)) {
        inputs.push({
          kind: 'track',
          path: track.file_path,
          trimStart,
          trimEnd,
        })
      }

      if (nextTransition && fs.existsSync(nextTransition.previewPath)) {
        inputs.push({
          kind: 'transition',
          path: nextTransition.previewPath,
        })
      }
    })

    return inputs
  }

  buildFilterGraph(inputs: TimelineInput[]): string {
    if (inputs.length === 0) {
      throw new Error('Cannot build a filter graph without inputs')
    }

    const labels: string[] = []
    const chains = inputs.map((input, index) => {
      const outputLabel = inputs.length === 1 ? 'out' : `a${index}`
      const trimArgs: string[] = []

      if (typeof input.trimStart === 'number' && input.trimStart > 0) {
        trimArgs.push(`start=${this.formatSeconds(input.trimStart)}`)
      }
      if (typeof input.trimEnd === 'number') {
        trimArgs.push(`end=${this.formatSeconds(input.trimEnd)}`)
      }

      if (inputs.length > 1) {
        labels.push(`[${outputLabel}]`)
      }

      const trimFilter = trimArgs.length > 0 ? `atrim=${trimArgs.join(':')},` : ''
      return `[${index}:a]${trimFilter}asetpts=PTS-STARTPTS[${outputLabel}]`
    })

    if (inputs.length === 1) {
      return chains[0]
    }

    chains.push(`${labels.join('')}concat=n=${inputs.length}:v=0:a=1[out]`)
    return chains.join(';')
  }

  isRunning(eventId?: string): boolean {
    if (eventId) {
      const state = this.eventStates.get(eventId)
      return Boolean(state?.ffmpegProcess && !state.ffmpegProcess.killed) || fs.existsSync(getEventPlaylistPath(eventId))
    }

    return [...this.eventStates.keys()].some((id) => this.isRunning(id))
  }

  private getEventState(eventId: string): EventStreamState {
    const existing = this.eventStates.get(eventId)
    if (existing) {
      return existing
    }

    const state: EventStreamState = {
      ffmpegProcess: null,
      buildQueue: Promise.resolve(),
    }
    this.eventStates.set(eventId, state)
    return state
  }

  private async syncEventStreamInternal(eventId: string): Promise<void> {
    const playingTrack = await this.ensurePlayableNowPlaying(eventId)
    if (!playingTrack) {
      this.stopEventStream(eventId)
      return
    }

    const queuedTracks = await this.getQueuedTracks(eventId)
    const tracks = [playingTrack, ...queuedTracks]
      .filter((track, index, list) => list.findIndex((candidate) => candidate.id === track.id) === index)
      .slice(0, MAX_STREAM_TRACKS)

    const transitions = await Promise.all(
      tracks.slice(0, -1).map(async (track, index) => {
        try {
          return await this.transitionPlanner.plan(track, tracks[index + 1])
        } catch (error) {
          console.error('[StreamManager] Transition planning failed:', error)
          return null
        }
      })
    )

    const inputs = this.buildTimelineInputs(tracks, transitions)
    if (inputs.length === 0) {
      this.stopEventStream(eventId)
      return
    }

    await this.renderHls(eventId, inputs)
  }

  private async ensurePlayableNowPlaying(eventId: string): Promise<StreamTrack | null> {
    const playingTrack = await this.getPlayingTrack(eventId)
    if (playingTrack?.file_path && await this.isUsableTrackFile(playingTrack)) {
      return playingTrack
    }

    if (playingTrack) {
      await supabase
        .from('tracks')
        .update({ status: 'queued', started_at: null, file_path: null, essentia_features: null, duration: null })
        .eq('id', playingTrack.id)
    }

    return this.promoteFirstQueuedTrack(eventId)
  }

  private async getPlayingTrack(eventId: string): Promise<StreamTrack | null> {
    const { data: tracks } = await supabase
      .from('tracks')
      .select(STREAM_TRACK_FIELDS)
      .eq('event_id', eventId)
      .eq('status', 'playing')
      .order('started_at', { ascending: true })
      .limit(1)

    return (tracks as StreamTrack[] | null)?.[0] ?? null
  }

  private async promoteFirstQueuedTrack(eventId: string): Promise<StreamTrack | null> {
    const { data: tracks } = await supabase
      .from('tracks')
      .select(STREAM_TRACK_FIELDS)
      .eq('event_id', eventId)
      .eq('status', 'queued')
      .not('file_path', 'is', null)
      .order('position', { ascending: true })
      .limit(1)

    const track = await this.findFirstUsableTrack((tracks as StreamTrack[] | null) ?? [])
    if (!track) {
      return null
    }

    const startedAt = new Date().toISOString()
    await supabase
      .from('tracks')
      .update({ status: 'playing', started_at: startedAt })
      .eq('id', track.id)

    return {
      ...track,
      status: 'playing',
      started_at: startedAt,
    }
  }

  private async getQueuedTracks(eventId: string): Promise<StreamTrack[]> {
    const { data } = await supabase
      .from('tracks')
      .select(STREAM_TRACK_FIELDS)
      .eq('event_id', eventId)
      .eq('status', 'queued')
      .not('file_path', 'is', null)
      .order('position', { ascending: true })
      .limit(Math.max(0, MAX_STREAM_TRACKS - 1))

    return this.filterUsableTracks((data as StreamTrack[] | null) ?? [])
  }

  private async renderHls(eventId: string, inputs: TimelineInput[]): Promise<void> {
    const eventDir = getEventStreamDir(eventId)
    const playlistPath = getEventPlaylistPath(eventId)
    const filterGraph = this.buildFilterGraph(inputs)
    const args = [
      '-y',
      ...inputs.flatMap((input) => ['-i', input.path]),
      '-filter_complex',
      filterGraph,
      '-map',
      '[out]',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-f',
      'hls',
      '-hls_time',
      '6',
      '-hls_list_size',
      '0',
      '-hls_playlist_type',
      'vod',
      '-hls_flags',
      'independent_segments',
      '-hls_segment_filename',
      path.join(eventDir, 'segment_%03d.ts'),
      playlistPath,
    ]

    if (fs.existsSync(eventDir)) {
      fs.rmSync(eventDir, { recursive: true, force: true })
    }
    fs.mkdirSync(eventDir, { recursive: true })

    await this.spawnFfmpegBuild(eventId, args)
  }

  private async spawnFfmpegBuild(eventId: string, args: string[]): Promise<void> {
    const state = this.getEventState(eventId)

    if (state.ffmpegProcess) {
      state.ffmpegProcess.removeAllListeners()
      state.ffmpegProcess.kill('SIGTERM')
      state.ffmpegProcess = null
    }

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', args)
      let stderr = ''

      state.ffmpegProcess = proc

      proc.stderr.on('data', (chunk: Buffer) => {
        const line = chunk.toString()
        stderr += line

        if (line.toLowerCase().includes('error') && !line.includes('Last message repeated')) {
          console.error('[ffmpeg error]', line.trim())
        }
      })

      proc.on('close', (code: number | null) => {
        if (state.ffmpegProcess === proc) {
          state.ffmpegProcess = null
        }

        if (code === 0) {
          resolve()
          return
        }

        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-1500)}`))
      })

      proc.on('error', (error: Error) => {
        if (state.ffmpegProcess === proc) {
          state.ffmpegProcess = null
        }
        reject(error)
      })
    })
  }

  private stopEventStream(eventId: string): void {
    const state = this.eventStates.get(eventId)
    if (state?.ffmpegProcess) {
      state.ffmpegProcess.removeAllListeners()
      state.ffmpegProcess.kill('SIGTERM')
      state.ffmpegProcess = null
    }

    const eventDir = getEventStreamDir(eventId)
    if (fs.existsSync(eventDir)) {
      fs.rmSync(eventDir, { recursive: true, force: true })
    }
  }

  private hasTrackBody(trimStart?: number, trimEnd?: number): boolean {
    if (typeof trimEnd !== 'number') {
      return true
    }

    return trimEnd - (trimStart ?? 0) > 0.05
  }

  private normalizeTime(value: number): number {
    return Math.max(0, Math.round(value * 1000) / 1000)
  }

  private formatSeconds(value: number): string {
    return this.normalizeTime(value).toFixed(3)
  }

  private async findFirstUsableTrack(tracks: StreamTrack[]): Promise<StreamTrack | null> {
    const usableTracks = await this.filterUsableTracks(tracks)
    return usableTracks[0] ?? null
  }

  private async filterUsableTracks(tracks: StreamTrack[]): Promise<StreamTrack[]> {
    const usable: StreamTrack[] = []

    for (const track of tracks) {
      if (await this.isUsableTrackFile(track)) {
        usable.push(track)
        continue
      }

      if (track.file_path) {
        await supabase
          .from('tracks')
          .update({ file_path: null, essentia_features: null, duration: null })
          .eq('id', track.id)
      }
    }

    return usable
  }

  private async isUsableTrackFile(track: StreamTrack): Promise<boolean> {
    if (!track.file_path) {
      return false
    }

    return isPlayableAudioFile(track.file_path)
  }
}
