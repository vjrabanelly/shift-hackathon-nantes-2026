/**
 * API client for ECHA Visualizer backend.
 * Connects to the visualizer server running on the PC.
 */

// Default: visualizer runs on the same host (dev) or configured IP
const BASE_URL = localStorage.getItem('echa-api-url') || 'http://localhost:3000';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

export interface EnrichmentStats {
  totalPosts: number;
  totalEnriched: number;
  enrichmentRate: number;
  avgPolarization: number;
  avgConfidence: number;
  reviewFlagged: number;
  byPolitical: Array<{ politicalExplicitnessScore: number; _count: number }>;
  byNarrative: Array<{ narrativeFrame: string; _count: number }>;
  polarBuckets: { low: number; medium: number; high: number; extreme: number };
  topTopics: Array<[string, number]>;
}

export interface EnrichedPost {
  id: string;
  semanticSummary: string | null;
  normalizedText: string | null;
  mainTopics: string;
  secondaryTopics: string;
  politicalExplicitnessScore: number;
  polarizationScore: number;
  confidenceScore: number;
  narrativeFrame: string | null;
  tone: string | null;
  primaryEmotion: string | null;
  emotionIntensity: number;
  contentDomain: string | null;
  audienceTarget: string | null;
  persons: string;
  organizations: string;
  institutions: string;
  countries: string;
  politicalIssueTags: string;
  politicalActors: string;
  activismSignal: boolean;
  conflictSignal: boolean;
  ingroupOutgroupSignal: boolean;
  moralAbsoluteSignal: boolean;
  enemyDesignationSignal: boolean;
  callToActionType: string | null;
  problemSolutionPattern: string | null;
  reviewFlag: boolean;
  reviewReason: string | null;
  provider: string | null;
  model: string | null;
  axisEconomic: number;
  axisSocietal: number;
  axisAuthority: number;
  axisSystem: number;
  dominantAxis: string | null;
  post?: {
    username: string;
    caption: string | null;
    mediaType: string;
    attentionLevel: string;
    dwellTimeMs: number;
    isSponsored: boolean;
  };
}

export interface AxesData {
  total: number;
  withSignal: number;
  averages: { economic: number; societal: number; authority: number; system: number };
  dominantCounts: Record<string, number>;
  distribution: Record<string, { negative: number; neutral: number; positive: number }>;
}

export function getEnrichmentStats(): Promise<EnrichmentStats> {
  return fetchJson('/api/enrichment/stats');
}

export function getEnrichedPosts(params: {
  political_min?: number;
  political_max?: number;
  narrative?: string;
  review?: boolean;
  limit?: number;
} = {}): Promise<EnrichedPost[]> {
  const sp = new URLSearchParams();
  sp.set('political_min', String(params.political_min ?? 0));
  sp.set('political_max', String(params.political_max ?? 4));
  if (params.narrative) sp.set('narrative', params.narrative);
  if (params.review) sp.set('review', '1');
  sp.set('limit', String(params.limit ?? 50));
  return fetchJson(`/api/enrichment/posts?${sp}`);
}

export function getAxesData(): Promise<AxesData> {
  return fetchJson('/api/enrichment/axes');
}

export function setApiUrl(url: string): void {
  localStorage.setItem('echa-api-url', url);
  location.reload();
}

export function safeParse(json: string | null | undefined): string[] {
  try { return JSON.parse(json || '[]'); } catch { return []; }
}
