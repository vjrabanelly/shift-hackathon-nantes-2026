"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartyStore = void 0;
exports.buildRequestSummary = buildRequestSummary;
exports.createDefaultStore = createDefaultStore;
const node_crypto_1 = require("node:crypto");
const DEFAULT_EVENT_ID = 'demo-event';
const DEFAULT_GUEST_ID = 'guest-mobile';
class PartyStore {
    events = new Map();
    constructor() {
        this.ensureEvent(DEFAULT_EVENT_ID);
        this.ensureGuest(DEFAULT_EVENT_ID, DEFAULT_GUEST_ID, 'Invite mobile');
    }
    ensureEvent(eventId) {
        const existing = this.events.get(eventId);
        if (existing) {
            return existing;
        }
        const event = buildDefaultEvent(eventId);
        const state = {
            event,
            guests: new Map(),
            tracks: new Map(),
            requests: new Map(),
            sessions: new Map(),
            joysticks: new Map(),
            collective: { valence: 0, energy: 0 }
        };
        const nowPlaying = buildDefaultTrack(eventId);
        const queued = buildQueuedTrack(eventId);
        state.tracks.set(nowPlaying.id, nowPlaying);
        state.tracks.set(queued.id, queued);
        this.events.set(eventId, state);
        return state;
    }
    ensureGuest(eventId, guestId = DEFAULT_GUEST_ID, displayName = 'Invite mobile') {
        const state = this.ensureEvent(eventId);
        const existing = state.guests.get(guestId);
        if (existing) {
            return existing;
        }
        const guest = {
            id: guestId,
            event_id: eventId,
            display_name: displayName,
            emoji: '🎧',
            joined_at: nowIso()
        };
        state.guests.set(guest.id, guest);
        return guest;
    }
    getGuest(eventId, guestId) {
        return this.ensureGuest(eventId, guestId);
    }
    getEventResponse(eventId) {
        const state = this.ensureEvent(eventId);
        return {
            event: state.event,
            now_playing: this.getNowPlaying(eventId),
            queue: this.getQueuedTracks(eventId),
            history: [],
            guest_count: state.guests.size,
            collective_joystick: this.getCollectivePosition(eventId)
        };
    }
    getQueueResponse(eventId) {
        return {
            now_playing: this.getNowPlaying(eventId),
            queued: this.getQueuedTracks(eventId)
        };
    }
    getNowPlaying(eventId) {
        const state = this.ensureEvent(eventId);
        const track = [...state.tracks.values()]
            .filter((entry) => entry.status === 'playing')
            .sort((left, right) => left.position - right.position)[0] ?? null;
        if (!track) {
            return null;
        }
        return {
            track,
            started_at: track.started_at ?? track.created_at,
            elapsed_seconds: 42
        };
    }
    getQueuedTracks(eventId) {
        const state = this.ensureEvent(eventId);
        return [...state.tracks.values()]
            .filter((track) => track.status === 'queued')
            .sort((left, right) => left.position - right.position)
            .map((track) => ({
            track,
            position: track.position,
            added_by_display: track.added_by === 'ai' ? '🤖 IA' : `${state.guests.get(track.added_by)?.emoji ?? '🎧'} ${state.guests.get(track.added_by)?.display_name ?? 'Invite'}`
        }));
    }
    getQueueTracks(eventId) {
        const state = this.ensureEvent(eventId);
        return [...state.tracks.values()].filter((track) => track.status !== 'played');
    }
    getCollectivePosition(eventId) {
        const state = this.ensureEvent(eventId);
        if (state.collective) {
            return state.collective;
        }
        if (state.joysticks.size === 0) {
            return { valence: 0, energy: 0 };
        }
        const values = [...state.joysticks.values()];
        const totals = values.reduce((accumulator, current) => ({
            valence: accumulator.valence + current.valence,
            energy: accumulator.energy + current.energy
        }), { valence: 0, energy: 0 });
        return {
            valence: roundMetric(totals.valence / values.length),
            energy: roundMetric(totals.energy / values.length)
        };
    }
    updateJoystick(eventId, guestId, valence, energy) {
        const state = this.ensureEvent(eventId);
        this.ensureGuest(eventId, guestId);
        state.joysticks.set(guestId, {
            id: (0, node_crypto_1.randomUUID)(),
            event_id: eventId,
            guest_id: guestId,
            valence: clamp(valence),
            energy: clamp(energy),
            updated_at: nowIso()
        });
        state.collective = {
            valence: roundMetric(valence),
            energy: roundMetric(energy)
        };
        return this.getCollectivePosition(eventId);
    }
    hydrateEventContext(input) {
        const state = this.ensureEvent(input.event.id);
        state.event = input.event;
        state.collective = input.collective;
        if (input.guest) {
            state.guests.set(input.guest.id, input.guest);
        }
        state.tracks.clear();
        input.tracks.forEach((track) => {
            state.tracks.set(track.id, track);
        });
    }
    recordRequest(eventId, guestId, rawText) {
        const state = this.ensureEvent(eventId);
        const request = {
            id: (0, node_crypto_1.randomUUID)(),
            event_id: eventId,
            guest_id: guestId,
            raw_text: rawText,
            status: 'pending',
            created_at: nowIso()
        };
        state.requests.set(request.id, request);
        return request;
    }
    getLatestRequestForGuest(eventId, guestId) {
        const state = this.ensureEvent(eventId);
        return [...state.requests.values()]
            .filter((request) => request.guest_id === guestId)
            .sort((left, right) => right.created_at.localeCompare(left.created_at))[0] ?? null;
    }
    resolveRequest(eventId, requestId, trackId) {
        const state = this.ensureEvent(eventId);
        const request = state.requests.get(requestId);
        if (!request) {
            return;
        }
        request.status = 'resolved';
        request.resolved_track_id = trackId;
    }
    ensureSession(eventId, guestId) {
        const state = this.ensureEvent(eventId);
        const existing = state.sessions.get(guestId);
        if (existing) {
            return existing;
        }
        const session = {
            id: (0, node_crypto_1.randomUUID)(),
            event_id: eventId,
            guest_id: guestId,
            opened_at: nowIso(),
            updated_at: nowIso(),
            messages: [
                {
                    id: (0, node_crypto_1.randomUUID)(),
                    role: 'assistant',
                    text: "Quelle musique vous voulez mettre après ? Quel style de musique ou qu'est-ce que vous cherchez ?",
                    created_at: nowIso(),
                    decision: 'idle'
                }
            ],
            pending_candidates: [],
            rejected_candidate_ids: [],
            selected_preview_by_candidate: {}
        };
        state.sessions.set(guestId, session);
        return session;
    }
    resetSession(eventId, guestId) {
        const state = this.ensureEvent(eventId);
        state.sessions.delete(guestId);
        for (const [requestId, request] of state.requests.entries()) {
            if (request.guest_id === guestId) {
                state.requests.delete(requestId);
            }
        }
        return this.ensureSession(eventId, guestId);
    }
    appendMessage(eventId, guestId, message) {
        const session = this.ensureSession(eventId, guestId);
        session.messages.push({
            id: (0, node_crypto_1.randomUUID)(),
            created_at: nowIso(),
            ...message
        });
        session.updated_at = nowIso();
        return session;
    }
    replacePendingCandidates(eventId, guestId, candidates) {
        const session = this.ensureSession(eventId, guestId);
        session.pending_candidates = candidates;
        session.updated_at = nowIso();
        return session;
    }
    rejectCandidate(eventId, guestId, candidateId) {
        const session = this.ensureSession(eventId, guestId);
        if (!session.rejected_candidate_ids.includes(candidateId)) {
            session.rejected_candidate_ids.push(candidateId);
        }
        session.pending_candidates = session.pending_candidates.filter((candidate) => candidate.id !== candidateId);
        delete session.selected_preview_by_candidate[candidateId];
        session.updated_at = nowIso();
        return session;
    }
    selectPreviewSource(eventId, guestId, candidateId, sourceId) {
        const session = this.ensureSession(eventId, guestId);
        const candidate = session.pending_candidates.find((entry) => entry.id === candidateId);
        if (!candidate) {
            throw new Error('candidate_not_found');
        }
        const source = candidate.sources.find((entry) => entry.id === sourceId) ?? candidate.primary_source;
        session.selected_preview_by_candidate[candidateId] = source.id;
        session.updated_at = nowIso();
        return { session, candidate, source };
    }
    confirmCandidate(eventId, guestId, candidateId) {
        const state = this.ensureEvent(eventId);
        const session = this.ensureSession(eventId, guestId);
        const candidate = session.pending_candidates.find((entry) => entry.id === candidateId);
        if (!candidate) {
            throw new Error('candidate_not_found');
        }
        if (candidate.duplicate_of_track_id) {
            const duplicateTrack = state.tracks.get(candidate.duplicate_of_track_id);
            if (!duplicateTrack) {
                throw new Error('duplicate_track_missing');
            }
            return { session, track: duplicateTrack };
        }
        const selectedSourceId = session.selected_preview_by_candidate[candidate.id];
        const primarySource = candidate.sources.find((source) => source.id === selectedSourceId) ?? candidate.primary_source;
        const nextPosition = Math.max(0, ...[...state.tracks.values()].map((track) => track.position)) + 1;
        const youtubeSource = candidate.sources.find((source) => source.platform === 'youtube');
        const track = {
            id: (0, node_crypto_1.randomUUID)(),
            event_id: eventId,
            title: candidate.title,
            artist: candidate.artist,
            duration: 240,
            youtube_id: youtubeSource?.external_id,
            cover_url: candidate.artwork_url,
            essentia_features: candidate.metrics?.bpm
                ? {
                    bpm: candidate.metrics.bpm,
                    key: candidate.metrics.key ?? 'Unknown',
                    energy: candidate.metrics.energy ?? 0.5,
                    mood: candidate.why_it_matches
                }
                : null,
            primary_source: primarySource,
            linked_sources: candidate.sources,
            audio_metrics: candidate.metrics ?? null,
            added_by: guestId,
            status: 'queued',
            position: nextPosition,
            created_at: nowIso()
        };
        state.tracks.set(track.id, track);
        session.pending_candidates = session.pending_candidates.filter((entry) => entry.id !== candidateId);
        delete session.selected_preview_by_candidate[candidateId];
        session.updated_at = nowIso();
        return { session, track };
    }
    getSession(eventId, guestId) {
        return this.ensureSession(eventId, guestId);
    }
    getEvent(eventId) {
        return this.ensureEvent(eventId).event;
    }
}
exports.PartyStore = PartyStore;
function buildDefaultEvent(eventId) {
    return {
        id: eventId,
        admin_token: `tok_${(0, node_crypto_1.randomUUID)().replace(/-/g, '').slice(0, 32)}`,
        name: 'Shift Hackathon Party',
        vibe_config: {
            context: "Prototype mobile de recherche musicale pour la soirée de démo.",
            energy_profile: 'moderate',
            genre_allow: ['house', 'dance', 'indie electronic'],
            genre_block: []
        },
        genre_rules: {
            allow: ['house', 'dance', 'indie electronic'],
            block: []
        },
        seed_playlist: [
            { title: 'Midnight City', artist: 'M83', youtube_id: 'dX3k_QDnzHE' },
            { title: 'Music Sounds Better With You', artist: 'Stardust', youtube_id: 'FQlAEiCb8m0' }
        ],
        created_at: nowIso()
    };
}
function buildDefaultTrack(eventId) {
    const sources = [
        buildSource('spotify', '1eyzqe2QqGZUmfcPZtrIyt', 'https://open.spotify.com/track/1eyzqe2QqGZUmfcPZtrIyt', 'https://open.spotify.com/embed/track/1eyzqe2QqGZUmfcPZtrIyt'),
        buildSource('youtube', 'dX3k_QDnzHE', 'https://www.youtube.com/watch?v=dX3k_QDnzHE', 'https://www.youtube.com/embed/dX3k_QDnzHE')
    ];
    return {
        id: (0, node_crypto_1.randomUUID)(),
        event_id: eventId,
        title: 'Midnight City',
        artist: 'M83',
        duration: 240,
        youtube_id: 'dX3k_QDnzHE',
        cover_url: 'https://i.scdn.co/image/ab67616d0000b273d68fbc3fbe7ce4c9c282db2f',
        essentia_features: {
            bpm: 105,
            key: 'B major',
            energy: 0.68,
            mood: 'night drive'
        },
        primary_source: sources[0],
        linked_sources: sources,
        audio_metrics: {
            bpm: 105,
            energy: 0.68,
            valence: 0.56,
            popularity: 86,
            play_count: 540000000,
            source: 'bootstrap'
        },
        added_by: 'ai',
        status: 'playing',
        position: 0,
        started_at: nowIso(),
        created_at: nowIso()
    };
}
function buildQueuedTrack(eventId) {
    const sources = [
        buildSource('spotify', '303ccTay2FiDTZ9fZ2AdBt', 'https://open.spotify.com/track/303ccTay2FiDTZ9fZ2AdBt', 'https://open.spotify.com/embed/track/303ccTay2FiDTZ9fZ2AdBt'),
        buildSource('youtube', 'FQlAEiCb8m0', 'https://www.youtube.com/watch?v=FQlAEiCb8m0', 'https://www.youtube.com/embed/FQlAEiCb8m0')
    ];
    return {
        id: (0, node_crypto_1.randomUUID)(),
        event_id: eventId,
        title: 'Music Sounds Better With You',
        artist: 'Stardust',
        duration: 260,
        youtube_id: 'FQlAEiCb8m0',
        cover_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=80',
        essentia_features: {
            bpm: 124,
            key: 'F minor',
            energy: 0.73,
            mood: 'sunlit groove'
        },
        primary_source: sources[0],
        linked_sources: sources,
        audio_metrics: {
            bpm: 124,
            energy: 0.73,
            valence: 0.9,
            popularity: 83,
            play_count: 320000000,
            source: 'bootstrap'
        },
        added_by: 'ai',
        status: 'queued',
        position: 1,
        created_at: nowIso()
    };
}
function buildSource(platform, externalId, url, embedUrl) {
    return {
        id: `${platform}:${externalId}`,
        platform,
        external_id: externalId,
        url,
        embed_url: embedUrl,
        preview_url: embedUrl,
        label: platform,
        playable: true
    };
}
function nowIso() {
    return new Date().toISOString();
}
function clamp(value) {
    return Math.max(-1, Math.min(1, value));
}
function roundMetric(value) {
    return Math.round(value * 100) / 100;
}
function buildRequestSummary(store, eventId, guestId) {
    return {
        session: store.getSession(eventId, guestId),
        now_playing: store.getNowPlaying(eventId),
        queue: store.getQueuedTracks(eventId)
    };
}
function createDefaultStore() {
    return new PartyStore();
}
//# sourceMappingURL=store.js.map