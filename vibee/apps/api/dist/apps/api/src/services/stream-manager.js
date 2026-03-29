"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamManager = void 0;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const media_paths_1 = require("../lib/media-paths");
const ytdlp_1 = require("../lib/ytdlp");
const supabase_1 = require("../lib/supabase");
const transition_planner_1 = require("./transition-planner");
const STREAM_TRACK_FIELDS = 'id, event_id, title, artist, duration, youtube_id, file_path, cover_url, status, position, started_at, created_at';
const MAX_STREAM_TRACKS = 4;
class StreamManager {
    static instance;
    eventStates = new Map();
    transitionPlanner = new transition_planner_1.TransitionPlanner();
    static getInstance() {
        if (!StreamManager.instance) {
            StreamManager.instance = new StreamManager();
        }
        return StreamManager.instance;
    }
    init() {
        node_fs_1.default.mkdirSync(media_paths_1.HLS_ROOT_DIR, { recursive: true });
        node_fs_1.default.mkdirSync(media_paths_1.TRANSITIONS_DIR, { recursive: true });
    }
    getStreamUrl(eventId) {
        return `/stream/${eventId}/playlist.m3u8`;
    }
    async startStream(eventId) {
        await this.syncEventStream(eventId);
    }
    buildAcrossfadeFilter(trackCount) {
        if (trackCount === 1) {
            return '[0:a]anull[out]';
        }
        if (trackCount === 2) {
            return '[0:a][1:a]acrossfade=d=3:c1=tri:c2=tri[out]';
        }
        let filter = '[0:a][1:a]acrossfade=d=3:c1=tri:c2=tri[a01]';
        let previous = 'a01';
        for (let index = 2; index < trackCount; index++) {
            const next = index === trackCount - 1 ? 'out' : `a0${index}`;
            filter += `;[${previous}][${index}:a]acrossfade=d=3:c1=tri:c2=tri[${next}]`;
            previous = next;
        }
        return filter;
    }
    async syncEventStream(eventId) {
        const state = this.getEventState(eventId);
        const nextBuild = state.buildQueue
            .catch(() => undefined)
            .then(async () => {
            await this.syncEventStreamInternal(eventId);
        });
        state.buildQueue = nextBuild;
        return nextBuild;
    }
    async advanceToNextTrack(eventId) {
        await this.advanceTrackInDb(eventId);
        await this.syncEventStream(eventId);
    }
    async advanceTrackInDb(eventId) {
        const currentTrack = await this.getPlayingTrack(eventId);
        if (currentTrack) {
            await supabase_1.supabase
                .from('tracks')
                .update({ status: 'played' })
                .eq('id', currentTrack.id);
        }
        await this.promoteFirstQueuedTrack(eventId);
    }
    buildTimelineInputs(tracks, transitions) {
        const inputs = [];
        tracks.forEach((track, index) => {
            if (!track.file_path) {
                return;
            }
            const previousTransition = index > 0 ? transitions[index - 1] : null;
            const nextTransition = index < transitions.length ? transitions[index] : null;
            const trimStart = previousTransition
                ? this.normalizeTime(previousTransition.targetWindow.end)
                : undefined;
            const trimEnd = nextTransition
                ? this.normalizeTime(nextTransition.sourceWindow.start)
                : undefined;
            if (this.hasTrackBody(trimStart, trimEnd)) {
                inputs.push({
                    kind: 'track',
                    path: track.file_path,
                    trimStart,
                    trimEnd,
                });
            }
            if (nextTransition && node_fs_1.default.existsSync(nextTransition.previewPath)) {
                inputs.push({
                    kind: 'transition',
                    path: nextTransition.previewPath,
                });
            }
        });
        return inputs;
    }
    buildFilterGraph(inputs) {
        if (inputs.length === 0) {
            throw new Error('Cannot build a filter graph without inputs');
        }
        const labels = [];
        const chains = inputs.map((input, index) => {
            const outputLabel = inputs.length === 1 ? 'out' : `a${index}`;
            const trimArgs = [];
            if (typeof input.trimStart === 'number' && input.trimStart > 0) {
                trimArgs.push(`start=${this.formatSeconds(input.trimStart)}`);
            }
            if (typeof input.trimEnd === 'number') {
                trimArgs.push(`end=${this.formatSeconds(input.trimEnd)}`);
            }
            if (inputs.length > 1) {
                labels.push(`[${outputLabel}]`);
            }
            const trimFilter = trimArgs.length > 0 ? `atrim=${trimArgs.join(':')},` : '';
            return `[${index}:a]${trimFilter}asetpts=PTS-STARTPTS[${outputLabel}]`;
        });
        if (inputs.length === 1) {
            return chains[0];
        }
        chains.push(`${labels.join('')}concat=n=${inputs.length}:v=0:a=1[out]`);
        return chains.join(';');
    }
    isRunning(eventId) {
        if (eventId) {
            const state = this.eventStates.get(eventId);
            return Boolean(state?.ffmpegProcess && !state.ffmpegProcess.killed) || node_fs_1.default.existsSync((0, media_paths_1.getEventPlaylistPath)(eventId));
        }
        return [...this.eventStates.keys()].some((id) => this.isRunning(id));
    }
    getEventState(eventId) {
        const existing = this.eventStates.get(eventId);
        if (existing) {
            return existing;
        }
        const state = {
            ffmpegProcess: null,
            buildQueue: Promise.resolve(),
        };
        this.eventStates.set(eventId, state);
        return state;
    }
    async syncEventStreamInternal(eventId) {
        const playingTrack = await this.ensurePlayableNowPlaying(eventId);
        if (!playingTrack) {
            this.stopEventStream(eventId);
            return;
        }
        const queuedTracks = await this.getQueuedTracks(eventId);
        const tracks = [playingTrack, ...queuedTracks]
            .filter((track, index, list) => list.findIndex((candidate) => candidate.id === track.id) === index)
            .slice(0, MAX_STREAM_TRACKS);
        const transitions = await Promise.all(tracks.slice(0, -1).map(async (track, index) => {
            try {
                return await this.transitionPlanner.plan(track, tracks[index + 1]);
            }
            catch (error) {
                console.error('[StreamManager] Transition planning failed:', error);
                return null;
            }
        }));
        const inputs = this.buildTimelineInputs(tracks, transitions);
        if (inputs.length === 0) {
            this.stopEventStream(eventId);
            return;
        }
        await this.renderHls(eventId, inputs);
    }
    async ensurePlayableNowPlaying(eventId) {
        const playingTrack = await this.getPlayingTrack(eventId);
        if (playingTrack?.file_path && await this.isUsableTrackFile(playingTrack)) {
            return playingTrack;
        }
        if (playingTrack) {
            await supabase_1.supabase
                .from('tracks')
                .update({ status: 'queued', started_at: null, file_path: null, essentia_features: null, duration: null })
                .eq('id', playingTrack.id);
        }
        return this.promoteFirstQueuedTrack(eventId);
    }
    async getPlayingTrack(eventId) {
        const { data: tracks } = await supabase_1.supabase
            .from('tracks')
            .select(STREAM_TRACK_FIELDS)
            .eq('event_id', eventId)
            .eq('status', 'playing')
            .order('started_at', { ascending: true })
            .limit(1);
        return tracks?.[0] ?? null;
    }
    async promoteFirstQueuedTrack(eventId) {
        const { data: tracks } = await supabase_1.supabase
            .from('tracks')
            .select(STREAM_TRACK_FIELDS)
            .eq('event_id', eventId)
            .eq('status', 'queued')
            .not('file_path', 'is', null)
            .order('position', { ascending: true })
            .limit(1);
        const track = await this.findFirstUsableTrack(tracks ?? []);
        if (!track) {
            return null;
        }
        const startedAt = new Date().toISOString();
        await supabase_1.supabase
            .from('tracks')
            .update({ status: 'playing', started_at: startedAt })
            .eq('id', track.id);
        return {
            ...track,
            status: 'playing',
            started_at: startedAt,
        };
    }
    async getQueuedTracks(eventId) {
        const { data } = await supabase_1.supabase
            .from('tracks')
            .select(STREAM_TRACK_FIELDS)
            .eq('event_id', eventId)
            .eq('status', 'queued')
            .not('file_path', 'is', null)
            .order('position', { ascending: true })
            .limit(Math.max(0, MAX_STREAM_TRACKS - 1));
        return this.filterUsableTracks(data ?? []);
    }
    async renderHls(eventId, inputs) {
        const eventDir = (0, media_paths_1.getEventStreamDir)(eventId);
        const playlistPath = (0, media_paths_1.getEventPlaylistPath)(eventId);
        const filterGraph = this.buildFilterGraph(inputs);
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
            node_path_1.default.join(eventDir, 'segment_%03d.ts'),
            playlistPath,
        ];
        if (node_fs_1.default.existsSync(eventDir)) {
            node_fs_1.default.rmSync(eventDir, { recursive: true, force: true });
        }
        node_fs_1.default.mkdirSync(eventDir, { recursive: true });
        await this.spawnFfmpegBuild(eventId, args);
    }
    async spawnFfmpegBuild(eventId, args) {
        const state = this.getEventState(eventId);
        if (state.ffmpegProcess) {
            state.ffmpegProcess.removeAllListeners();
            state.ffmpegProcess.kill('SIGTERM');
            state.ffmpegProcess = null;
        }
        await new Promise((resolve, reject) => {
            const proc = (0, node_child_process_1.spawn)('ffmpeg', args);
            let stderr = '';
            state.ffmpegProcess = proc;
            proc.stderr.on('data', (chunk) => {
                const line = chunk.toString();
                stderr += line;
                if (line.toLowerCase().includes('error') && !line.includes('Last message repeated')) {
                    console.error('[ffmpeg error]', line.trim());
                }
            });
            proc.on('close', (code) => {
                if (state.ffmpegProcess === proc) {
                    state.ffmpegProcess = null;
                }
                if (code === 0) {
                    resolve();
                    return;
                }
                reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-1500)}`));
            });
            proc.on('error', (error) => {
                if (state.ffmpegProcess === proc) {
                    state.ffmpegProcess = null;
                }
                reject(error);
            });
        });
    }
    stopEventStream(eventId) {
        const state = this.eventStates.get(eventId);
        if (state?.ffmpegProcess) {
            state.ffmpegProcess.removeAllListeners();
            state.ffmpegProcess.kill('SIGTERM');
            state.ffmpegProcess = null;
        }
        const eventDir = (0, media_paths_1.getEventStreamDir)(eventId);
        if (node_fs_1.default.existsSync(eventDir)) {
            node_fs_1.default.rmSync(eventDir, { recursive: true, force: true });
        }
    }
    hasTrackBody(trimStart, trimEnd) {
        if (typeof trimEnd !== 'number') {
            return true;
        }
        return trimEnd - (trimStart ?? 0) > 0.05;
    }
    normalizeTime(value) {
        return Math.max(0, Math.round(value * 1000) / 1000);
    }
    formatSeconds(value) {
        return this.normalizeTime(value).toFixed(3);
    }
    async findFirstUsableTrack(tracks) {
        const usableTracks = await this.filterUsableTracks(tracks);
        return usableTracks[0] ?? null;
    }
    async filterUsableTracks(tracks) {
        const usable = [];
        for (const track of tracks) {
            if (await this.isUsableTrackFile(track)) {
                usable.push(track);
                continue;
            }
            if (track.file_path) {
                await supabase_1.supabase
                    .from('tracks')
                    .update({ file_path: null, essentia_features: null, duration: null })
                    .eq('id', track.id);
            }
        }
        return usable;
    }
    async isUsableTrackFile(track) {
        if (!track.file_path) {
            return false;
        }
        return (0, ytdlp_1.isPlayableAudioFile)(track.file_path);
    }
}
exports.StreamManager = StreamManager;
//# sourceMappingURL=stream-manager.js.map