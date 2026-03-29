import {
  getCognitiveThemes,
  safeParse,
  type PostEntry,
} from './db-bridge.js';
import { normalizeSeries, type NormalizationStrategy } from './normalization.js';

export type VisualizationMode =
  | 'bubble'
  | 'bar'
  | 'radar'
  | 'scatter'
  | 'heatmap'
  | 'treemap'
  | 'donut';

export type CognitiveMetricKey =
  | 'frequency'
  | 'durationTotalMs'
  | 'durationAverageMs'
  | 'engagement'
  | 'engagedShare'
  | 'politicalScore'
  | 'polarization'
  | 'confidence';

export type CognitiveThemeSource = 'mainTopics' | 'mediaCategory' | 'fallback';

export interface CognitiveMetricDefinition {
  key: CognitiveMetricKey;
  label: string;
  description: string;
  unit: string;
  sqliteSource: string;
}

export interface CognitiveMetricRanges {
  frequency: { min: number; max: number };
  durationTotalMs: { min: number; max: number };
  durationAverageMs: { min: number; max: number };
  engagement: { min: number; max: number };
  engagedShare: { min: number; max: number };
  politicalScore: { min: number; max: number };
  polarization: { min: number; max: number };
  confidence: { min: number; max: number };
}

export interface CognitiveThemeAggregate {
  themeId: string;
  themeLabel: string;
  source: CognitiveThemeSource;
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
  rawMetrics: Record<CognitiveMetricKey, number>;
  normalizedMetrics?: Partial<Record<CognitiveMetricKey, number>>;
}

export interface CognitiveBubbleDataset {
  session: null;
  posts: PostEntry[];
  themes: CognitiveThemeAggregate[];
  metricRanges: CognitiveMetricRanges;
  totalPosts: number;
  totalAvailablePosts: number;
  totalThemes: number;
  isPartial: boolean;
}

export interface CognitiveBubbleLoadOptions {
  limit?: number;
}

export interface CognitiveNormalizationOptions {
  strategies?: Partial<Record<CognitiveMetricKey, NormalizationStrategy>>;
  clipPercentiles?: readonly [number, number];
}

export const COGNITIVE_METRICS: CognitiveMetricDefinition[] = [
  {
    key: 'frequency',
    label: 'Poids dans le fil',
    description: 'Part de votre fil occupée par cette thématique.',
    unit: 'posts',
    sqliteSource: 'COUNT(posts.id)',
  },
  {
    key: 'durationTotalMs',
    label: 'Temps cumulé',
    description: 'Temps total passé sur cette thématique.',
    unit: 'ms',
    sqliteSource: 'SUM(posts.dwellTimeMs)',
  },
  {
    key: 'durationAverageMs',
    label: 'Temps par post',
    description: 'Temps moyen passé sur chaque post de cette thématique.',
    unit: 'ms',
    sqliteSource: 'AVG(posts.dwellTimeMs)',
  },
  {
    key: 'engagement',
    label: 'Attention',
    description: 'Intensité moyenne de votre attention sur cette thématique.',
    unit: '0-100',
    sqliteSource: 'posts.attentionLevel + posts.dwellTimeMs',
  },
  {
    key: 'engagedShare',
    label: 'Part très regardée',
    description: 'Part des posts de cette thématique vraiment regardés.',
    unit: '%',
    sqliteSource: 'posts.attentionLevel',
  },
  {
    key: 'politicalScore',
    label: 'Politisation',
    description: 'Degré moyen de contenu politique dans cette thématique.',
    unit: '0-4',
    sqliteSource: 'post_enriched.politicalExplicitnessScore',
  },
  {
    key: 'polarization',
    label: 'Tension polarisante',
    description: 'Niveau moyen de polarisation de cette thématique.',
    unit: '0-1',
    sqliteSource: 'post_enriched.polarizationScore',
  },
  {
    key: 'confidence',
    label: 'Fiabilité du classement',
    description: 'Confiance moyenne du moteur de classement sur cette thématique.',
    unit: '0-1',
    sqliteSource: 'post_enriched.confidenceScore',
  },
];

const ATTENTION_SCORES: Record<string, number> = {
  skipped: 0,
  glanced: 33,
  viewed: 66,
  engaged: 100,
};

const DEFAULT_NORMALIZATION_STRATEGIES: Record<CognitiveMetricKey, NormalizationStrategy> = {
  frequency: 'clipped-min-max',
  durationTotalMs: 'log-min-max',
  durationAverageMs: 'clipped-min-max',
  engagement: 'min-max',
  engagedShare: 'min-max',
  politicalScore: 'min-max',
  polarization: 'min-max',
  confidence: 'min-max',
};

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'non-classe';
}

function parseTopics(post: PostEntry): string[] {
  const topics = post.enrichment ? safeParse(post.enrichment.mainTopics) : [];
  return topics.map(t => String(t).trim()).filter(Boolean);
}

function resolveTheme(post: PostEntry): { themeLabel: string; source: CognitiveThemeSource } {
  const topics = parseTopics(post);
  if (topics.length > 0) {
    return { themeLabel: topics[0], source: 'mainTopics' };
  }

  const mediaCategory = post.enrichment?.mediaCategory?.trim();
  if (mediaCategory) {
    return { themeLabel: mediaCategory, source: 'mediaCategory' };
  }

  return { themeLabel: 'non classifié', source: 'fallback' };
}

function resolveAttentionScore(post: PostEntry): number {
  const fromLevel = ATTENTION_SCORES[post.attentionLevel || ''];
  if (fromLevel !== undefined) return fromLevel;

  const dwellSec = Math.max(0, asNumber(post.dwellTimeMs) / 1000);
  if (dwellSec < 0.5) return ATTENTION_SCORES.skipped;
  if (dwellSec < 2) return ATTENTION_SCORES.glanced;
  if (dwellSec < 5) return ATTENTION_SCORES.viewed;
  return ATTENTION_SCORES.engaged;
}

function metricValue(theme: CognitiveThemeAggregate, key: CognitiveMetricKey): number {
  switch (key) {
    case 'frequency':
      return theme.postCount;
    case 'durationTotalMs':
      return theme.totalDwellTimeMs;
    case 'durationAverageMs':
      return theme.averageDwellTimeMs;
    case 'engagement':
      return theme.engagementScore;
    case 'engagedShare':
      return theme.engagedShare;
    case 'politicalScore':
      return theme.politicalScoreAverage;
    case 'polarization':
      return theme.polarizationAverage;
    case 'confidence':
      return theme.confidenceAverage;
  }
}

export function getCognitiveMetricDefinition(key: CognitiveMetricKey): CognitiveMetricDefinition | undefined {
  return COGNITIVE_METRICS.find(metric => metric.key === key);
}

export function getCognitiveMetricValue(theme: CognitiveThemeAggregate, key: CognitiveMetricKey): number {
  return metricValue(theme, key);
}

export function aggregateCognitiveThemes(posts: PostEntry[]): CognitiveThemeAggregate[] {
  const buckets = new Map<string, {
    themeLabel: string;
    source: CognitiveThemeSource;
    postCount: number;
    totalDwellTimeMs: number;
    attentionSum: number;
    engagedCount: number;
    politicalSum: number;
    politicalCount: number;
    polarizationSum: number;
    polarizationCount: number;
    confidenceSum: number;
    confidenceCount: number;
    enrichedPostCount: number;
    samplePostIds: string[];
    sampleUsers: Set<string>;
  }>();

  for (const post of posts) {
    const { themeLabel, source } = resolveTheme(post);
    const themeId = normalizeLabel(themeLabel);
    const dwellTimeMs = Math.max(0, asNumber(post.dwellTimeMs));
    const attentionScore = clamp(resolveAttentionScore(post), 0, 100);
    const enrichment = post.enrichment;

    let bucket = buckets.get(themeId);
    if (!bucket) {
      bucket = {
        themeLabel,
        source,
        postCount: 0,
        totalDwellTimeMs: 0,
        attentionSum: 0,
        engagedCount: 0,
        politicalSum: 0,
        politicalCount: 0,
        polarizationSum: 0,
        polarizationCount: 0,
        confidenceSum: 0,
        confidenceCount: 0,
        enrichedPostCount: 0,
        samplePostIds: [],
        sampleUsers: new Set<string>(),
      };
      buckets.set(themeId, bucket);
    }

    bucket.postCount += 1;
    bucket.totalDwellTimeMs += dwellTimeMs;
    bucket.attentionSum += attentionScore;
    if (attentionScore >= 66) bucket.engagedCount += 1;

    if (enrichment) {
      bucket.enrichedPostCount += 1;
      bucket.politicalSum += asNumber(enrichment.politicalScore);
      bucket.politicalCount += 1;

      bucket.polarizationSum += clamp(asNumber(enrichment.polarizationScore), 0, 1);
      bucket.polarizationCount += 1;

      bucket.confidenceSum += clamp(asNumber(enrichment.confidenceScore), 0, 1);
      bucket.confidenceCount += 1;
    }

    if (post.postId && bucket.samplePostIds.length < 5) {
      bucket.samplePostIds.push(post.postId);
    }
    if (post.username) {
      bucket.sampleUsers.add(post.username);
    }
  }

  const themes = [...buckets.entries()].map(([themeId, bucket]) => {
    const averageDwellTimeMs = bucket.postCount > 0 ? bucket.totalDwellTimeMs / bucket.postCount : 0;
    const engagementScore = bucket.postCount > 0 ? bucket.attentionSum / bucket.postCount : 0;
    const engagedShare = bucket.postCount > 0 ? (bucket.engagedCount / bucket.postCount) * 100 : 0;
    const politicalScoreAverage = bucket.politicalCount > 0 ? bucket.politicalSum / bucket.politicalCount : 0;
    const polarizationAverage = bucket.polarizationCount > 0 ? bucket.polarizationSum / bucket.polarizationCount : 0;
    const confidenceAverage = bucket.confidenceCount > 0 ? bucket.confidenceSum / bucket.confidenceCount : 0;

    const rawMetrics: Record<CognitiveMetricKey, number> = {
      frequency: bucket.postCount,
      durationTotalMs: bucket.totalDwellTimeMs,
      durationAverageMs: averageDwellTimeMs,
      engagement: engagementScore,
      engagedShare,
      politicalScore: politicalScoreAverage,
      polarization: polarizationAverage,
      confidence: confidenceAverage,
    };

    return {
      themeId,
      themeLabel: bucket.themeLabel,
      source: bucket.source,
      postCount: bucket.postCount,
      totalDwellTimeMs: bucket.totalDwellTimeMs,
      averageDwellTimeMs,
      engagementScore,
      engagedShare,
      politicalScoreAverage,
      polarizationAverage,
      confidenceAverage,
      enrichedPostCount: bucket.enrichedPostCount,
      samplePostIds: bucket.samplePostIds,
      sampleUsers: [...bucket.sampleUsers].slice(0, 5),
      rawMetrics,
    } satisfies CognitiveThemeAggregate;
  });

  return themes.sort((a, b) => {
    if (b.totalDwellTimeMs !== a.totalDwellTimeMs) return b.totalDwellTimeMs - a.totalDwellTimeMs;
    if (b.postCount !== a.postCount) return b.postCount - a.postCount;
    return a.themeLabel.localeCompare(b.themeLabel, 'fr');
  });
}

export function normalizeCognitiveThemes(
  themes: CognitiveThemeAggregate[],
  options: CognitiveNormalizationOptions = {},
): { themes: CognitiveThemeAggregate[]; metricRanges: CognitiveMetricRanges } {
  const clipPercentiles: readonly [number, number] = options.clipPercentiles ?? [0.05, 0.95];
  const metricResults = COGNITIVE_METRICS.reduce((acc, metric) => {
    const values = themes.map(theme => metricValue(theme, metric.key));
    const strategy = options.strategies?.[metric.key] ?? DEFAULT_NORMALIZATION_STRATEGIES[metric.key];
    acc[metric.key] = normalizeSeries(values, { strategy, clipPercentiles });
    return acc;
  }, {} as Record<CognitiveMetricKey, ReturnType<typeof normalizeSeries>>);

  const metricRanges = COGNITIVE_METRICS.reduce((acc, metric) => {
    const result = metricResults[metric.key];
    acc[metric.key] = result ? result.rawRange : { min: 0, max: 0 };
    return acc;
  }, {} as CognitiveMetricRanges);

  const normalizedThemes = themes.map((theme, index) => {
    const normalizedMetrics = COGNITIVE_METRICS.reduce((acc, metric) => {
      const result = metricResults[metric.key];
      acc[metric.key] = result?.values[index] ?? 0;
      return acc;
    }, {} as Partial<Record<CognitiveMetricKey, number>>);

    return {
      ...theme,
      normalizedMetrics,
    };
  });

  return { themes: normalizedThemes, metricRanges };
}

export async function loadCognitiveBubbleData(options: CognitiveBubbleLoadOptions = {}): Promise<CognitiveBubbleDataset> {
  const themeResult = await getCognitiveThemes();
  if (themeResult.totalPosts === 0) {
    const emptyThemes: CognitiveThemeAggregate[] = [];
    const normalized = normalizeCognitiveThemes(emptyThemes);
    return {
      session: null,
      posts: [],
      themes: normalized.themes,
      metricRanges: normalized.metricRanges,
      totalPosts: 0,
      totalAvailablePosts: 0,
      totalThemes: 0,
      isPartial: false,
    };
  }

  const totalAvailablePosts = themeResult.totalPosts;
  const posts: PostEntry[] = [];
  const themes = themeResult.themes.map(theme => ({
    ...theme,
    rawMetrics: {
      frequency: theme.postCount,
      durationTotalMs: theme.totalDwellTimeMs,
      durationAverageMs: theme.averageDwellTimeMs,
      engagement: theme.engagementScore,
      engagedShare: theme.engagedShare,
      politicalScore: theme.politicalScoreAverage,
      polarization: theme.polarizationAverage,
      confidence: theme.confidenceAverage,
    },
  } satisfies CognitiveThemeAggregate));
  const normalized = normalizeCognitiveThemes(themes);

  return {
    session: null,
    posts,
    themes: normalized.themes,
    metricRanges: normalized.metricRanges,
    totalPosts: themeResult.totalPosts,
    totalAvailablePosts,
    totalThemes: normalized.themes.length,
    isPartial: themeResult.totalPosts < totalAvailablePosts,
  };
}
