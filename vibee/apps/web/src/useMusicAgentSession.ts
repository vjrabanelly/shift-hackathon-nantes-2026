import { useEffect, useState } from 'react';
import { resolveApiBase } from './lib/api';

export type TrackSourcePlatform =
  | 'youtube'
  | 'spotify'
  | 'soundcloud'
  | 'deezer'
  | 'apple_music'
  | 'jamendo'
  | 'audius'
  | 'unknown';

export interface TrackSource {
  id: string;
  platform: TrackSourcePlatform;
  external_id: string;
  url: string;
  embed_url?: string;
  preview_url?: string;
  label: string;
  playable: boolean;
}

export interface AudioMetrics {
  bpm?: number;
  energy?: number;
  valence?: number;
  danceability?: number;
  popularity?: number;
  play_count?: number;
}

export interface SearchCandidate {
  id: string;
  title: string;
  artist: string;
  artwork_url?: string;
  genres: string[];
  confidence: number;
  why_it_matches: string;
  summary: string;
  source_platforms: TrackSourcePlatform[];
  primary_source: TrackSource;
  sources: TrackSource[];
  metrics?: AudioMetrics | null;
  verification_status?: 'unverified' | 'needs_confirmation' | 'verified';
  verification_notes?: string[];
  already_in_queue?: boolean;
  duplicate_of_track_id?: string;
}

export interface SearchTrace {
  id: string;
  agent: string;
  tool: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  query?: string;
  summary: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  created_at: string;
  candidates?: SearchCandidate[];
  search_traces?: SearchTrace[];
  decision?: 'idle' | 'previewing' | 'confirmed' | 'rejected' | 'queued';
}

export interface AgentSession {
  id: string;
  event_id: string;
  guest_id: string;
  opened_at: string;
  updated_at: string;
  messages: AgentMessage[];
  pending_candidates: SearchCandidate[];
  rejected_candidate_ids: string[];
  selected_preview_by_candidate: Record<string, string>;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  duration?: number;
  cover_url?: string;
  primary_source?: TrackSource;
  linked_sources?: TrackSource[];
  audio_metrics?: AudioMetrics | null;
}

export interface NowPlayingState {
  track: Track;
  started_at: string;
  elapsed_seconds: number;
}

export interface QueuedTrack {
  track: Track;
  position: number;
  added_by_display?: string;
}

interface SessionResponse {
  session: AgentSession;
  now_playing: NowPlayingState | null;
  queue: QueuedTrack[];
}

interface AgentPreviewResponse {
  session: AgentSession;
  candidate: SearchCandidate;
  selected_source: TrackSource;
}

interface ResetSessionResponse {
  session: AgentSession;
}

interface TranscribeResponse {
  text: string;
}

const API_BASE = resolveApiBase();
const INITIAL_ASSISTANT_MESSAGE = "Quelle musique vous voulez mettre après ? Quel style de musique ou qu'est-ce que vous cherchez ?";

export function useMusicAgentSession(eventId: string, guestId: string) {
  const [session, setSession] = useState<AgentSession | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlayingState | null>(null);
  const [queue, setQueue] = useState<QueuedTrack[]>([]);
  const [isBooting, setIsBooting] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTraces, setPendingTraces] = useState<SearchTrace[]>([]);

  useEffect(() => {
    let cancelled = false;
    const storageKey = buildSessionStorageKey(eventId, guestId);
    const cachedSession = readCachedSession(storageKey);

    if (cachedSession) {
      setSession(cachedSession);
      setIsBooting(false);
    }

    const bootstrap = async () => {
      if (!cachedSession) {
        setIsBooting(true);
      }
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/events/${eventId}/agent/session?guest_id=${guestId}`);
        if (!response.ok) {
          throw new Error('session_bootstrap_failed');
        }

        const payload = (await response.json()) as SessionResponse;
        if (cancelled) {
          return;
        }

        const normalizedSession = sanitizeSession(payload.session);
        setSession((currentSession) => mergeSessions(currentSession, normalizedSession));
        setNowPlaying(payload.now_playing);
        setQueue(payload.queue);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'session_bootstrap_failed');
        }
      } finally {
        if (!cancelled) {
          setIsBooting(false);
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [eventId, guestId]);

  useEffect(() => {
    if (!session) {
      return;
    }

    try {
      window.localStorage.setItem(buildSessionStorageKey(eventId, guestId), JSON.stringify(session));
    } catch {
      // Ignore storage quota and private mode failures.
    }
  }, [eventId, guestId, session]);

  const sendMessage = async (message: string, joystick: { valence: number; energy: number }) => {
    setIsSending(true);
    setError(null);
    setPendingTraces(buildPendingTraces(message));
    const optimisticUserMessage = createOptimisticUserMessage(message);
    setSession((currentSession) => appendOptimisticUserMessage(currentSession, eventId, guestId, optimisticUserMessage));

    try {
      const response = await fetch(`${API_BASE}/events/${eventId}/agent/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_id: guestId,
          message,
          joystick,
        }),
      });

      if (!response.ok) {
        throw new Error('turn_failed');
      }

      const payload = (await response.json()) as { session: AgentSession };
      setSession(sanitizeSession(payload.session));
      return payload;
    } catch (nextError) {
      setSession((currentSession) => removeOptimisticMessage(currentSession, optimisticUserMessage.id));
      setError(nextError instanceof Error ? nextError.message : 'turn_failed');
      throw nextError;
    } finally {
      setIsSending(false);
      setPendingTraces([]);
    }
  };

  const selectPreviewSource = async (candidateId: string, sourceId: string) => {
    setError(null);
    const response = await fetch(`${API_BASE}/events/${eventId}/agent/candidates/${candidateId}/preview/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guest_id: guestId,
        source_id: sourceId,
      }),
    });

    if (!response.ok) {
      throw new Error('preview_select_failed');
    }

    const payload = (await response.json()) as AgentPreviewResponse;
    setSession(sanitizeSession(payload.session));
    return payload;
  };

  const rejectCandidate = async (candidateId: string) => {
    setIsSending(true);
    setError(null);
    setPendingTraces(buildPendingTraces('retry'));
    try {
      const response = await fetch(`${API_BASE}/events/${eventId}/agent/candidates/${candidateId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_id: guestId,
        }),
      });

      if (!response.ok) {
        throw new Error('reject_failed');
      }

      const payload = (await response.json()) as { session: AgentSession };
      setSession(sanitizeSession(payload.session));
      return payload;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'reject_failed');
      throw nextError;
    } finally {
      setIsSending(false);
      setPendingTraces([]);
    }
  };

  const confirmCandidate = async (candidateId: string) => {
    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/events/${eventId}/agent/candidates/${candidateId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_id: guestId,
        }),
      });

      if (!response.ok) {
        const reason = await readApiError(response, 'confirm_failed');
        throw new Error(reason);
      }

      const payload = (await response.json()) as { session: AgentSession; queue: QueuedTrack[] };
      setSession(sanitizeSession(payload.session));
      setQueue(payload.queue);
      return payload;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'confirm_failed');
      throw nextError;
    } finally {
      setIsSending(false);
    }
  };

  const clearSession = async () => {
    setError(null);
    setPendingTraces([]);

    const response = await fetch(`${API_BASE}/events/${eventId}/agent/session/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guest_id: guestId,
      }),
    });

    if (!response.ok) {
      throw new Error('session_reset_failed');
    }

    const payload = (await response.json()) as ResetSessionResponse;
    const sanitized = sanitizeSession(payload.session);
    setSession(sanitized);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(buildSessionStorageKey(eventId, guestId), JSON.stringify(sanitized));
    }

    return payload;
  };

  const transcribeAudio = async (audioBlob: Blob, mimeType?: string) => {
    setError(null);
    const audioBase64 = await blobToBase64(audioBlob);
    const response = await fetch(`${API_BASE}/events/${eventId}/agent/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guest_id: guestId,
        audio_base64: audioBase64,
        mime_type: mimeType ?? audioBlob.type ?? 'audio/webm',
      }),
    });

    if (!response.ok) {
      const message = await readApiError(response, 'transcribe_failed');
      setError(message);
      throw new Error(message);
    }

    const payload = (await response.json()) as TranscribeResponse;
    return payload.text?.trim() ?? '';
  };

  return {
    session,
    nowPlaying,
    queue,
    isBooting,
    isSending,
    pendingTraces,
    error,
    sendMessage,
    selectPreviewSource,
    rejectCandidate,
    confirmCandidate,
    clearSession,
    transcribeAudio,
  };
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string; message?: string };
    return payload.error || payload.message || fallback;
  } catch {
    return fallback;
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function buildSessionStorageKey(eventId: string, guestId: string) {
  return `partyjam_agent_session_${eventId}_${guestId}`;
}

function readCachedSession(storageKey: string): AgentSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    return sanitizeSession(JSON.parse(raw) as AgentSession);
  } catch {
    return null;
  }
}

function sanitizeSession(session: AgentSession): AgentSession {
  return {
    ...session,
    messages: sanitizeMessages(session.messages ?? []),
    pending_candidates: dedupeCandidates(session.pending_candidates ?? []),
  };
}

function sanitizeMessages(messages: AgentMessage[]): AgentMessage[] {
  const dedupedMessages: AgentMessage[] = [];
  const seenAssistantFingerprints = new Set<string>();

  for (const message of messages) {
    const sanitizedMessage: AgentMessage = {
      ...message,
      candidates: message.candidates ? dedupeCandidates(message.candidates) : undefined,
    };

    const fingerprint = buildMessageFingerprint(sanitizedMessage);
    if (sanitizedMessage.role === 'assistant' && seenAssistantFingerprints.has(fingerprint)) {
      continue;
    }

    if (sanitizedMessage.role === 'assistant') {
      seenAssistantFingerprints.add(fingerprint);
    }

    dedupedMessages.push(sanitizedMessage);
  }

  return dedupedMessages;
}

function dedupeCandidates(candidates: SearchCandidate[]): SearchCandidate[] {
  const byTrack = new Map<string, SearchCandidate>();

  for (const candidate of candidates) {
    const key = `${normalizeLookupValue(candidate.title)}::${normalizeLookupValue(candidate.artist)}`;
    const existing = byTrack.get(key);
    if (!existing || candidate.confidence > existing.confidence) {
      byTrack.set(key, {
        ...candidate,
        sources: dedupeSources(candidate.sources),
      });
    }
  }

  return [...byTrack.values()];
}

function dedupeSources(sources: TrackSource[]): TrackSource[] {
  const bySource = new Map<string, TrackSource>();

  for (const source of sources) {
    const key = `${source.platform}::${source.external_id || source.url}`;
    if (!bySource.has(key)) {
      bySource.set(key, source);
    }
  }

  return [...bySource.values()];
}

function createOptimisticUserMessage(text: string): AgentMessage {
  return {
    id: `optimistic:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    role: 'user',
    text,
    created_at: new Date().toISOString(),
    decision: 'idle',
  };
}

function appendOptimisticUserMessage(
  currentSession: AgentSession | null,
  eventId: string,
  guestId: string,
  optimisticMessage: AgentMessage
): AgentSession {
  const baseSession =
    currentSession ??
    sanitizeSession({
      id: `local:${eventId}:${guestId}`,
      event_id: eventId,
      guest_id: guestId,
      opened_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [
        {
          id: 'assistant:intro',
          role: 'assistant',
          text: INITIAL_ASSISTANT_MESSAGE,
          created_at: new Date().toISOString(),
          decision: 'idle',
        },
      ],
      pending_candidates: [],
      rejected_candidate_ids: [],
      selected_preview_by_candidate: {},
    });

  return sanitizeSession({
    ...baseSession,
    updated_at: new Date().toISOString(),
    messages: [...baseSession.messages, optimisticMessage],
  });
}

function removeOptimisticMessage(currentSession: AgentSession | null, messageId: string): AgentSession | null {
  if (!currentSession) {
    return null;
  }

  return {
    ...currentSession,
    messages: currentSession.messages.filter((message) => message.id !== messageId),
  };
}

function mergeSessions(currentSession: AgentSession | null, incomingSession: AgentSession): AgentSession {
  if (!currentSession) {
    return incomingSession;
  }

  const currentHasMoreHistory = currentSession.messages.length > incomingSession.messages.length;
  if (currentHasMoreHistory) {
    return sanitizeSession({
      ...incomingSession,
      messages: currentSession.messages,
      pending_candidates:
        incomingSession.pending_candidates.length > 0
          ? incomingSession.pending_candidates
          : currentSession.pending_candidates,
      rejected_candidate_ids: Array.from(
        new Set([...currentSession.rejected_candidate_ids, ...incomingSession.rejected_candidate_ids])
      ),
      selected_preview_by_candidate: {
        ...currentSession.selected_preview_by_candidate,
        ...incomingSession.selected_preview_by_candidate,
      },
    });
  }

  return incomingSession;
}

function buildMessageFingerprint(message: AgentMessage): string {
  const candidateFingerprint = (message.candidates ?? [])
    .map((candidate) => `${normalizeLookupValue(candidate.title)}::${normalizeLookupValue(candidate.artist)}`)
    .join('|');

  return `${message.role}::${normalizeLookupValue(message.text)}::${candidateFingerprint}`;
}

function normalizeLookupValue(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildPendingTraces(message: string): SearchTrace[] {
  const lowered = message.toLowerCase();
  const traces: SearchTrace[] = [
    {
      id: 'pending:web',
      agent: 'agent-web',
      tool: 'web search',
      status: 'running',
      query: message,
      summary: 'Recherche en cours sur le web et YouTube.',
    },
    {
      id: 'pending:music-db',
      agent: 'agent-metadata',
      tool: 'music databases',
      status: 'running',
      query: message,
      summary: 'Croisement en cours avec les bases musicales.',
    },
  ];

  if (lowered.includes('parole') || lowered.includes('lyrics') || lowered.includes('la la')) {
    traces.push({
      id: 'pending:lyrics',
      agent: 'agent-lyrics',
      tool: 'lyrics',
      status: 'running',
      query: message,
      summary: 'Recherche en cours dans les paroles.',
    });
  }

  traces.push({
    id: 'pending:analysis',
    agent: 'agent-analysis',
    tool: 'analysis',
    status: 'pending',
    query: message,
    summary: 'Comparaison des pistes et vérification avant proposition.',
  });

  return traces;
}
