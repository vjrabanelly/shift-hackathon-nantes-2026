/**
 * DB Bridge — queries mobile SQLite via Capacitor InstaWebView plugin.
 * Replaces api.ts (PC visualizer) for local-first data access.
 */

function getPlugin(): any {
  if ((window as any).Capacitor?.Plugins?.InstaWebView) {
    return (window as any).Capacitor.Plugins.InstaWebView;
  }
  // Mock for browser dev
  console.warn('[ECHA] DB bridge: plugin not available (browser mode)');
  return {
    querySessions: async () => ({ sessions: '[]' }),
    queryPosts: async () => ({ posts: '[]' }),
    queryCognitiveThemes: async () => ({ themes: '[]', totalPosts: 0 }),
    queryStats: async () => ({
      totalSessions: 0, totalPosts: 0, totalEnriched: 0,
      attention: {}, political: {}, axes: {},
      topCategories: '[]', topUsers: '[]',
      topDomains: '[]', topTopics: '[]',
      totalDwellMs: 0,
    }),
    queryExportSession: async () => ({ data: '{}' }),
  };
}

// ── Types ────────────────────────────────────────────────────

export interface SessionSummary {
  id: string;
  capturedAt: number;
  durationSec: number;
  totalPosts: number;
  captureMode: string;
  postCount: number;
}

export interface PostEnrichment {
  politicalScore: number;
  polarizationScore: number;
  confidenceScore: number;
  mainTopics: string;        // JSON array
  secondaryTopics?: string;  // JSON array
  domains?: string;          // JSON array
  subjects?: string;         // JSON array
  preciseSubjects?: string;  // JSON array
  tone?: string;
  primaryEmotion?: string;
  emotionIntensity?: number;
  narrativeFrame?: string;
  mediaCategory: string;
  mediaQuality: string;
  mediaIntent?: string;
  callToActionType?: string;
  axisEconomic: number;
  axisSocietal: number;
  axisAuthority: number;
  axisSystem: number;
  dominantAxis: string;
  politicalActors?: string;  // JSON array
  activismSignal?: boolean;
  conflictSignal?: boolean;
  polarizationSignals?: string; // JSON object
  reviewFlag?: boolean;
  reviewReason?: string;
  semanticSummary?: string;
}

export interface PostEntry {
  id: string;
  sessionId: string;
  postId: string;
  username: string;
  caption: string;
  mediaType: string;
  likeCount: number;
  isSponsored: boolean;
  isSuggested: boolean;
  dwellTimeMs: number;
  attentionLevel: string;
  allText: string;
  seenCount: number;
  enrichment?: PostEnrichment;
}

export interface SubjectInsight {
  subject: string;
  count: number;
  totalDwellMs: number;
  avgDwellMs: number;
  attention: Record<string, number>;
  topAccounts: Array<{ username: string; count: number }>;
  dominantEmotion: string;
  dominantTone: string;
  domains: string[];
  avgPoliticalScore?: number;
  avgPolarization?: number;
  sampleCaption: string;
  sampleSummary: string;
}

export interface DbStats {
  totalSessions: number;
  totalPosts: number;
  totalEnriched: number;
  totalDwellMs: number;
  attention: Record<string, number>;
  political: Record<string, number>;
  axes?: { economic: number; societal: number; authority: number; system: number };
  avgPolarization?: number;
  avgConfidence?: number;
  topCategories: Array<{ category: string; count: number }>;
  topUsers: Array<{ username: string; count: number; totalDwellMs: number }>;
  topDomains: Array<{ domain: string; count: number }>;
  topTopics: Array<{ topic: string; count: number }>;
  topNarratives?: Array<{ narrative: string; count: number }>;
  topTones?: Array<{ tone: string; count: number }>;
  topEmotions?: Array<{ emotion: string; count: number }>;
  topActors?: Array<{ topic: string; count: number }>;
  topSubjects?: Array<{ topic: string; count: number }>;
  topPreciseSubjects?: Array<{ topic: string; count: number }>;
  topDomainsReal?: Array<{ domain: string; count: number }>;
  mediaTypes?: Array<{ type: string; count: number; totalDwellMs: number }>;
  dwellByTopic?: Array<{ topic: string; totalDwellMs: number; avgDwellMs: number; count: number }>;
  attentionPolitical?: Record<string, { avgPolitical: number; avgPolarization: number; count: number }>;
  polarizingAccounts?: Array<{ username: string; avgPolarization: number; avgPolitical: number; count: number; totalDwellMs: number }>;
  sponsoredStats?: { sponsored?: { count: number; avgDwellMs: number; avgPolitical: number }; organic?: { count: number; avgDwellMs: number; avgPolitical: number } };
  signals?: { activism: number; conflict: number; moralAbsolute: number; enemyDesignation: number; ingroupOutgroup: number; total: number };
  subjectInsights?: SubjectInsight[];
  preciseSubjectInsights?: SubjectInsight[];
}

export interface CognitiveThemeRow {
  themeId: string;
  themeLabel: string;
  source: 'mainTopics' | 'mediaCategory' | 'fallback';
  postCount: number;
  totalDwellTimeMs: number;
  averageDwellTimeMs: number;
  engagementScore: number;
  engagedShare: number;
  politicalScoreAverage: number;
  polarizationAverage: number;
  confidenceAverage: number;
  enrichedPostCount: number;
  samplePostIds: string[];
  sampleUsers: string[];
}

// ── Queries ──────────────────────────────────────────────────

export async function getSessions(): Promise<SessionSummary[]> {
  const result = await getPlugin().querySessions();
  try {
    return JSON.parse(result.sessions || '[]');
  } catch {
    return [];
  }
}

export async function getPosts(sessionId: string, offset = 0, limit = 50): Promise<PostEntry[]> {
  const result = await getPlugin().queryPosts({ sessionId, offset, limit });
  try {
    return JSON.parse(result.posts || '[]');
  } catch {
    return [];
  }
}

export async function getCognitiveThemes(sessionId?: string): Promise<{ themes: CognitiveThemeRow[]; totalPosts: number }> {
  const result = await getPlugin().queryCognitiveThemes(sessionId ? { sessionId } : {});
  try {
    return {
      themes: JSON.parse(result.themes || '[]'),
      totalPosts: Number(result.totalPosts || 0),
    };
  } catch {
    return { themes: [], totalPosts: 0 };
  }
}

export async function getStats(): Promise<DbStats> {
  const result = await getPlugin().queryStats();
  const stats: DbStats = {
    totalSessions: result.totalSessions || 0,
    totalPosts: result.totalPosts || 0,
    totalEnriched: result.totalEnriched || 0,
    totalDwellMs: result.totalDwellMs || 0,
    attention: typeof result.attention === 'string' ? JSON.parse(result.attention) : (result.attention || {}),
    political: typeof result.political === 'string' ? JSON.parse(result.political) : (result.political || {}),
    topCategories: typeof result.topCategories === 'string' ? JSON.parse(result.topCategories) : (result.topCategories || []),
    topUsers: typeof result.topUsers === 'string' ? JSON.parse(result.topUsers) : (result.topUsers || []),
    topDomains: typeof result.topDomains === 'string' ? JSON.parse(result.topDomains) : (result.topDomains || []),
    topTopics: typeof result.topTopics === 'string' ? JSON.parse(result.topTopics) : (result.topTopics || []),
  };
  if (result.axes) {
    stats.axes = typeof result.axes === 'string' ? JSON.parse(result.axes) : result.axes;
  }
  if (result.avgPolarization !== undefined) stats.avgPolarization = result.avgPolarization;
  if (result.avgConfidence !== undefined) stats.avgConfidence = result.avgConfidence;
  if (result.topNarratives) {
    stats.topNarratives = typeof result.topNarratives === 'string' ? JSON.parse(result.topNarratives) : result.topNarratives;
  }
  if (result.topTones) {
    stats.topTones = typeof result.topTones === 'string' ? JSON.parse(result.topTones) : result.topTones;
  }
  // Advanced cross-analyses
  const parseField = (f: any) => typeof f === 'string' ? JSON.parse(f) : (f || undefined);
  // Deep-parse: plugin may double-serialize nested fields inside arrays/objects
  const deepParse = (obj: any): any => {
    if (obj == null) return obj;
    if (typeof obj === 'string') {
      try { const p = JSON.parse(obj); return typeof p === 'object' ? deepParse(p) : p; } catch { return obj; }
    }
    if (Array.isArray(obj)) return obj.map(deepParse);
    if (typeof obj === 'object') {
      const out: any = {};
      for (const k of Object.keys(obj)) out[k] = deepParse(obj[k]);
      return out;
    }
    return obj;
  };
  if (result.topEmotions) stats.topEmotions = parseField(result.topEmotions);
  if (result.topActors) stats.topActors = parseField(result.topActors);
  if (result.topSubjects) stats.topSubjects = parseField(result.topSubjects);
  if (result.topPreciseSubjects) stats.topPreciseSubjects = parseField(result.topPreciseSubjects);
  if (result.topDomainsReal) stats.topDomainsReal = parseField(result.topDomainsReal);
  if (result.mediaTypes) stats.mediaTypes = parseField(result.mediaTypes);
  if (result.dwellByTopic) stats.dwellByTopic = parseField(result.dwellByTopic);
  if (result.attentionPolitical) stats.attentionPolitical = parseField(result.attentionPolitical);
  if (result.polarizingAccounts) stats.polarizingAccounts = parseField(result.polarizingAccounts);
  if (result.sponsoredStats) stats.sponsoredStats = parseField(result.sponsoredStats);
  if (result.signals) stats.signals = parseField(result.signals);
  if (result.subjectInsights) stats.subjectInsights = deepParse(parseField(result.subjectInsights));
  if (result.preciseSubjectInsights) stats.preciseSubjectInsights = deepParse(parseField(result.preciseSubjectInsights));
  return stats;
}

export async function exportSession(sessionId: string): Promise<any> {
  const result = await getPlugin().queryExportSession({ sessionId });
  try {
    return JSON.parse(result.data || '{}');
  } catch {
    return {};
  }
}

// ── Enrichment daemon queries ───────────────────────────────

export async function getUnenrichedPosts(limit = 20): Promise<any[]> {
  const result = await getPlugin().queryUnenrichedPosts({ limit });
  try {
    return JSON.parse(result.posts || '[]');
  } catch {
    return [];
  }
}

export async function countUnenrichedPosts(): Promise<number> {
  const result = await getPlugin().countUnenrichedPosts();
  return result.count || 0;
}

export async function saveEnrichmentFromApp(dbPostId: string, enrichment: Record<string, any>): Promise<void> {
  await getPlugin().saveEnrichmentFromApp({
    dbPostId,
    enrichment: JSON.stringify(enrichment),
  });
}

export async function resetAllEnrichments(): Promise<number> {
  const result = await getPlugin().resetAllEnrichments();
  return result.deleted || 0;
}

export async function deduplicatePosts(): Promise<number> {
  const plugin = getPlugin();
  if (!plugin?.deduplicatePosts) return 0;
  const result = await plugin.deduplicatePosts();
  return result.removed || 0;
}

export function safeParse(json: string | null | undefined): string[] {
  try { return JSON.parse(json || '[]'); } catch { return []; }
}

// ── Ontology resolution for Wrapped display ─────────────────

import { resolveEntityLocal } from './ontology.js';

export interface ResolvedEntity {
  raw: string;
  canonical: string;
  type: string;
  count: number;
}

/** Resolve raw topic/actor names to canonical forms via ontology */
export function resolveEntities(items: Array<{ topic?: string; narrative?: string; emotion?: string; username?: string; count: number }>): ResolvedEntity[] {
  return items.map(item => {
    const raw = item.topic || item.narrative || item.emotion || item.username || '';
    const resolved = resolveEntityLocal(raw);
    return {
      raw,
      canonical: resolved?.canonical || raw.replace(/_/g, ' '),
      type: resolved?.type || 'Unknown',
      count: item.count,
    };
  });
}
