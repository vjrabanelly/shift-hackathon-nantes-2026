import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { Track } from '@partyjam/shared'

const PYTHON_BIN = process.env.PYTHON_BIN ?? (process.platform === 'win32' ? 'python' : 'python3')

function resolveProjectRoot(startDir: string): string {
  let current = startDir

  for (;;) {
    if (fs.existsSync(path.join(current, 'services', 'transition_cli.py'))) {
      return current
    }

    const parent = path.dirname(current)
    if (parent === current) {
      throw new Error('Could not locate project root for transition planner')
    }

    current = parent
  }
}

const PROJECT_ROOT = resolveProjectRoot(__dirname)

type TransitionTrack = Pick<Track, 'id' | 'title' | 'artist' | 'file_path' | 'youtube_id'>

interface PlannerPayload {
  ok: boolean
  candidate?: {
    score?: number
    transition_type?: string
    preview_path?: string
    components?: Record<string, number>
    reasons?: string[]
    source_segment?: {
      start?: number
      end?: number
      duration?: number
    }
    target_segment?: {
      start?: number
      end?: number
      duration?: number
    }
  } | null
  error?: string
  traceback?: string
}

export interface PlannedTransition {
  score: number
  transitionType: string
  previewPath: string
  components: Record<string, number>
  reasons: string[]
  sourceWindow: {
    start: number
    end: number
    duration: number
  }
  targetWindow: {
    start: number
    end: number
    duration: number
  }
}

export class TransitionPlanner {
  private readonly cache = new Map<string, Promise<PlannedTransition | null>>()

  async plan(source: TransitionTrack, target: TransitionTrack): Promise<PlannedTransition | null> {
    const sourceInput = this.resolveInput(source)
    const targetInput = this.resolveInput(target)

    if (!sourceInput || !targetInput) {
      return null
    }

    const cacheKey = `${source.id}:${sourceInput}::${target.id}:${targetInput}`
    const existing = this.cache.get(cacheKey)
    if (existing) {
      return existing
    }

    const pending = this.run(sourceInput, targetInput)
      .catch((error) => {
        this.cache.delete(cacheKey)
        console.error(
          `[TransitionPlanner] Failed to plan ${source.title} -> ${target.title}:`,
          error
        )
        return null
      })

    this.cache.set(cacheKey, pending)
    return pending
  }

  private resolveInput(track: TransitionTrack): string | null {
    if (track.file_path && fs.existsSync(track.file_path)) {
      return track.file_path
    }

    if (track.youtube_id) {
      return `https://www.youtube.com/watch?v=${track.youtube_id}`
    }

    return null
  }

  private run(source: string, target: string): Promise<PlannedTransition | null> {
    return new Promise((resolve, reject) => {
      const child = spawn(PYTHON_BIN, ['-m', 'services.transition_cli'], {
        cwd: PROJECT_ROOT,
        env: process.env,
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString()
      })

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      child.on('error', (error: Error) => {
        reject(error)
      })

      child.on('close', (code: number | null) => {
        const trimmed = stdout.trim()
        let payload: PlannerPayload | null = null

        if (trimmed) {
          try {
            payload = JSON.parse(trimmed) as PlannerPayload
          } catch (error) {
            reject(
              new Error(
                `Transition planner returned invalid JSON: ${
                  error instanceof Error ? error.message : String(error)
                }\n${trimmed.slice(0, 1000)}`
              )
            )
            return
          }
        }

        if (code !== 0 || !payload?.ok) {
          const detail = payload?.error ?? stderr.trim() ?? `exit ${code}`
          reject(new Error(detail))
          return
        }

        const candidate = payload.candidate
        if (!candidate?.preview_path || !fs.existsSync(candidate.preview_path)) {
          resolve(null)
          return
        }

        resolve({
          score: Number(candidate.score ?? 0),
          transitionType: candidate.transition_type ?? 'transition',
          previewPath: candidate.preview_path,
          components: candidate.components ?? {},
          reasons: candidate.reasons ?? [],
          sourceWindow: {
            start: Number(candidate.source_segment?.start ?? 0),
            end: Number(candidate.source_segment?.end ?? 0),
            duration: Number(candidate.source_segment?.duration ?? 0),
          },
          targetWindow: {
            start: Number(candidate.target_segment?.start ?? 0),
            end: Number(candidate.target_segment?.end ?? 0),
            duration: Number(candidate.target_segment?.duration ?? 0),
          },
        })
      })

      child.stdin.end(JSON.stringify({ source, target }))
    })
  }
}
