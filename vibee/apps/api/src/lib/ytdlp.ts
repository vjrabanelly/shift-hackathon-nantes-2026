import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { AUDIO_DIR } from './media-paths'

async function probeAudioFile(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ])

    let stdout = ''

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.on('error', () => resolve(null))
    proc.on('close', (code: number | null) => {
      if (code !== 0) {
        resolve(null)
        return
      }

      const duration = Number.parseFloat(stdout.trim())
      resolve(Number.isFinite(duration) && duration > 1 ? duration : null)
    })
  })
}

export async function isPlayableAudioFile(filePath: string): Promise<boolean> {
  if (!fs.existsSync(filePath)) {
    return false
  }

  const stats = fs.statSync(filePath)
  if (stats.size <= 1024) {
    return false
  }

  return (await probeAudioFile(filePath)) !== null
}

export async function searchYouTube(query: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const args = [
      `ytsearch1:${query}`,
      '--get-id',
      '--no-playlist',
    ]

    const proc = spawn('yt-dlp', args)
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    proc.on('close', (code: number | null) => {
      const id = stdout.trim()
      resolve(id || null)
    })

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`))
    })
  })
}

export async function downloadYouTube(youtubeId: string): Promise<string> {
  const outputPath = path.join(AUDIO_DIR, `${youtubeId}.mp3`)

  if (await isPlayableAudioFile(outputPath)) {
    return outputPath
  }

  if (fs.existsSync(outputPath)) {
    fs.rmSync(outputPath, { force: true })
  }

  fs.mkdirSync(AUDIO_DIR, { recursive: true })

  return new Promise((resolve, reject) => {
    const args = [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '-o', outputPath,
      '--force-overwrites',
      '--no-playlist',
      '--no-part',
      '--no-warnings',
      `https://www.youtube.com/watch?v=${youtubeId}`,
    ]

    const proc = spawn('yt-dlp', args)
    let stderr = ''

    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    proc.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp download failed (exit ${code}): ${stderr.slice(-500)}`))
        return
      }

      isPlayableAudioFile(outputPath)
        .then((isPlayable) => {
          if (isPlayable) {
            resolve(outputPath)
            return
          }

          if (fs.existsSync(outputPath)) {
            fs.rmSync(outputPath, { force: true })
          }
          reject(new Error(`yt-dlp produced an invalid audio file for ${youtubeId}`))
        })
        .catch((error: Error) => {
          reject(new Error(`Failed to validate downloaded audio: ${error.message}`))
        })
    })

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`))
    })
  })
}
