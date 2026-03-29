import { existsSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import type { SearchCandidate, SearchTrace, Track, VibeConfig } from '@partyjam/shared'

export interface MusicSearchContext {
  query: string
  event_id: string
  guest_id: string
  vibe_config?: VibeConfig
  joystick?: {
    valence: number
    energy: number
  }
  now_playing?: Track | null
  queue: Track[]
  rejected_candidate_ids: string[]
  reference_candidate?: {
    title: string
    artist: string
  }
  intents?: string[]
  max_candidates?: number
}

export interface MusicSearchResult {
  candidates: SearchCandidate[]
  search_traces: SearchTrace[]
}

interface PythonResult {
  candidates?: SearchCandidate[]
  search_traces?: SearchTrace[]
}

export async function searchMusicCandidates(context: MusicSearchContext): Promise<MusicSearchResult> {
  const scriptPath = path.resolve(process.cwd(), '../../services/music-agent/search_service.py')
  if (!existsSync(scriptPath)) {
    return {
      candidates: [],
      search_traces: [
        {
          id: 'agent:web:missing-script',
          agent: 'agent-web',
          tool: 'music search',
          status: 'failed',
          query: context.query,
          summary: "Le service de recherche musicale n'est pas disponible sur ce serveur."
        }
      ]
    }
  }

  try {
    const result = await runPythonProcess(scriptPath, context)
    return {
      candidates: result.candidates ?? [],
      search_traces: result.search_traces ?? []
    }
  } catch {
    return {
      candidates: [],
      search_traces: [
        {
          id: 'agent:web:python-failed',
          agent: 'agent-web',
          tool: 'music search',
          status: 'failed',
          query: context.query,
          summary: 'La recherche musicale a échoué avant de pouvoir proposer un morceau.'
        }
      ]
    }
  }
}

function runPythonProcess(scriptPath: string, payload: MusicSearchContext): Promise<PythonResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [scriptPath], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    child.on('error', reject)

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `music agent exited with code ${String(code)}`))
        return
      }

      try {
        resolve(JSON.parse(stdout) as PythonResult)
      } catch (error) {
        reject(error)
      }
    })

    child.stdin.write(JSON.stringify(payload))
    child.stdin.end()
  })
}
