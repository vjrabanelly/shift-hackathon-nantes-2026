import { supabase } from '../lib/supabase'

type EnvRecord = Record<string, string | undefined>

function readEnv(name: string): string | undefined {
  const candidate = globalThis as { process?: { env?: EnvRecord } }
  return candidate.process?.env?.[name]
}

const QUEUE_ENGINE_MODEL = readEnv('OPENAI_QUEUE_MODEL') ?? 'gpt-4.1-mini'

interface TrackForQueue {
  id: string
  title?: string
  artist?: string
  created_at: string
  essentia_features?: {
    bpm?: number
    key?: string
    energy?: number
    valence?: number
    mood?: string
  } | null
}

interface JoystickSnapshot {
  guest_id: string
  valence: number
  energy: number
  updated_at?: string
}

interface QueueOrderResponse {
  ordered_positions?: number[]
}

interface CollectiveSnapshot {
  valence: number
  energy: number
}

export class QueueEngine {
  private static instance: QueueEngine | null = null

  static getInstance(): QueueEngine {
    if (!QueueEngine.instance) {
      QueueEngine.instance = new QueueEngine()
    }
    return QueueEngine.instance
  }

  start(): void {
    // No background loop for now. Reorders are triggered on demand.
  }

  computeCollective(positions: CollectiveSnapshot[]): CollectiveSnapshot {
    if (positions.length === 0) {
      return { valence: 0, energy: 0 }
    }

    const totals = positions.reduce(
      (accumulator, position) => ({
        valence: accumulator.valence + position.valence,
        energy: accumulator.energy + position.energy,
      }),
      { valence: 0, energy: 0 },
    )

    return {
      valence: totals.valence / positions.length,
      energy: totals.energy / positions.length,
    }
  }

  private extractOutputText(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null

    const candidate = payload as {
      output_text?: string
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
    }

    if (typeof candidate.output_text === 'string' && candidate.output_text.trim()) {
      return candidate.output_text
    }

    for (const item of candidate.output ?? []) {
      for (const content of item.content ?? []) {
        if (content.type === 'output_text' && typeof content.text === 'string' && content.text.trim()) {
          return content.text
        }
      }
    }

    return null
  }

  private async buildAiOrderedQueue(
    eventId: string,
    tracks: TrackForQueue[],
    anchor: TrackForQueue | null,
    joystickPositions: JoystickSnapshot[],
  ): Promise<TrackForQueue[]> {
    const openAiApiKey = readEnv('OPENAI_API_KEY')

    if (!openAiApiKey || tracks.length <= 1) {
      return tracks
    }

    const collective = this.computeCollective(joystickPositions)

    const trackPayload = tracks.map((track, index) => ({
      position_index: index + 1,
      id: track.id,
      title: track.title ?? '',
      artist: track.artist ?? '',
      created_at: track.created_at,
      essentia_features: track.essentia_features ?? null,
    }))

    const prompt = {
      event_id: eventId,
      target_collective_joystick: collective,
      joystick_positions: joystickPositions,
      now_playing: anchor
        ? {
            id: anchor.id,
            title: anchor.title ?? '',
            artist: anchor.artist ?? '',
            created_at: anchor.created_at,
            essentia_features: anchor.essentia_features ?? null,
          }
        : null,
      queued_tracks: trackPayload,
    }

    try {
      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiApiKey}`,
        },
        body: JSON.stringify({
          model: QUEUE_ENGINE_MODEL,
          input: [
            {
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text:
                    'You are an expert DJ queue planner. Reorder the queued tracks into a coherent party arc. Use the provided essentia features to keep transitions smooth, build momentum over time, and progressively steer the queue toward a more festive destination without creating abrupt jumps or a gloomy mid-set collapse. You must return a complete permutation of the provided queue items.',
                },
              ],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: `Return JSON only.\n\nContext:\n${JSON.stringify(prompt, null, 2)}\n\nRules:\n- Return all ${tracks.length} queued tracks exactly once.\n- Do not omit any item.\n- Do not invent any item.\n- Prefer smooth transitions in bpm, key, mood, energy, and valence.\n- If now_playing is present, the first queued track should connect naturally from it.\n- Shape the queue like a DJ set that generally builds toward more celebration and dancefloor payoff.\n- Avoid sending the middle of the queue into a sad or deflated phase unless the full queue is overwhelmingly sad to begin with.\n- If a sad or low-valence track is used, place it early as contrast or near the edges of the arc, not in the middle of the party climb.\n- Favor a gradual rise in perceived excitement across the queue: early tracks can be cooler or more spacious, middle tracks should lock the groove, late tracks should feel most festive, communal, and energetic.\n- Use target_collective_joystick as the destination mood for the overall queue arc, but do not satisfy it by sacrificing flow.\n- When several orders are possible, prefer the one that ends with the strongest positive energy.\n- Return only ordered_positions.\n- ordered_positions must be a permutation of integers 1 through ${tracks.length}.`,
                },
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'queue_order',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  ordered_positions: {
                    type: 'array',
                    items: { type: 'integer' },
                  },
                },
                required: ['ordered_positions'],
                additionalProperties: false,
              },
            },
          },
        }),
      })

      if (!res.ok) {
        const detail = await res.text()
        throw new Error(`Queue AI reorder failed: HTTP ${res.status} ${detail}`)
      }

      const payload = await res.json() as unknown
      const outputText = this.extractOutputText(payload)
      if (!outputText) {
        throw new Error('Queue AI reorder returned no output text')
      }

      const parsed = JSON.parse(outputText) as QueueOrderResponse
      const byId = new Map(tracks.map((track) => [track.id, track]))
      const byPosition = new Map(trackPayload.map((track) => [track.position_index, byId.get(track.id)!]))
      const seen = new Set<string>()
      const ordered: TrackForQueue[] = []

      const normalizedPositions = Array.isArray(parsed.ordered_positions)
        ? parsed.ordered_positions
        : []

      for (const positionIndex of normalizedPositions) {
        if (!Number.isInteger(positionIndex)) continue
        const track = byPosition.get(positionIndex)
        if (!track || seen.has(track.id)) continue
        ordered.push(track)
        seen.add(track.id)
      }

      if (ordered.length > 0 && ordered.length < tracks.length) {
        for (const track of tracks) {
          if (seen.has(track.id)) continue
          ordered.push(track)
          seen.add(track.id)
        }
      }

      if (ordered.length !== tracks.length) {
        console.error('[QueueEngine] Raw AI queue response:', outputText)
        throw new Error(`Queue AI reorder returned an unusable track ordering (${ordered.length}/${tracks.length})`)
      }

      return ordered
    } catch (err) {
      console.error('[QueueEngine] AI reorder failed, returning original order:', err)
      return tracks
    }
  }

  async reorder(eventId: string): Promise<void> {
    const { data: nowPlaying } = await supabase
      .from('tracks')
      .select('id, title, artist, created_at, essentia_features')
      .eq('event_id', eventId)
      .eq('status', 'playing')
      .maybeSingle()

    const { data: tracks, error } = await supabase
      .from('tracks')
      .select('id, title, artist, created_at, essentia_features')
      .eq('event_id', eventId)
      .eq('status', 'queued')
      .order('created_at', { ascending: true })

    if (error || !tracks) return

    const { data: joystickPositions } = await supabase
      .from('joystick_positions')
      .select('guest_id, valence, energy, updated_at')
      .eq('event_id', eventId)

    const orderedTracks = await this.buildAiOrderedQueue(
      eventId,
      tracks as TrackForQueue[],
      (nowPlaying as TrackForQueue | null | undefined) ?? null,
      (joystickPositions as JoystickSnapshot[] | null) ?? [],
    )

    await Promise.all(
      orderedTracks.map((track, index) =>
        supabase
          .from('tracks')
          .update({ position: index + 1 })
          .eq('id', track.id)
      )
    )
  }
}
