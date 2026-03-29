import os from 'node:os'
import path from 'node:path'

export const MEDIA_ROOT = process.env.PARTYJAM_MEDIA_ROOT ?? path.join(os.tmpdir(), 'partyjam')
export const AUDIO_DIR = path.join(MEDIA_ROOT, 'audio')
export const HLS_ROOT_DIR = path.join(MEDIA_ROOT, 'hls')
export const TRANSITIONS_DIR = path.join(MEDIA_ROOT, 'transitions')

export function getEventStreamDir(eventId: string): string {
  return path.join(HLS_ROOT_DIR, eventId)
}

export function getEventPlaylistPath(eventId: string): string {
  return path.join(getEventStreamDir(eventId), 'playlist.m3u8')
}
