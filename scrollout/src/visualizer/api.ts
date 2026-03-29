/**
 * ECHA Visualizer — REST API routes via Prisma.
 */

import { IncomingMessage, ServerResponse } from 'http';
import prisma from '../db/client';

type Handler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => Promise<void>;

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

const routes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
  {
    method: 'GET',
    pattern: /^\/api\/sessions$/,
    handler: async (_req, res) => {
      const sessions = await prisma.session.findMany({
        orderBy: { capturedAt: 'desc' },
        take: 50,
        include: { _count: { select: { posts: true } } },
      });
      json(res, sessions);
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/sessions\/([^/]+)\/posts$/,
    handler: async (_req, res, params) => {
      const posts = await prisma.post.findMany({
        where: { sessionId: params.id },
        orderBy: { dwellTimeMs: 'desc' },
      });
      json(res, posts);
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/posts\/([^/]+)$/,
    handler: async (_req, res, params) => {
      const post = await prisma.post.findUnique({
        where: { id: params.id },
        include: { enrichment: true },
      });
      if (!post) { json(res, { error: 'Not found' }, 404); return; }
      json(res, post);
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/stats$/,
    handler: async (_req, res) => {
      const [totalSessions, totalPosts, categories, attention, topUsers] = await Promise.all([
        prisma.session.count(),
        prisma.post.count(),
        prisma.post.groupBy({ by: ['category'], _count: true, orderBy: { _count: { category: 'desc' } } }),
        prisma.post.groupBy({ by: ['attentionLevel'], _count: true }),
        prisma.post.groupBy({ by: ['username'], _count: true, orderBy: { _count: { username: 'desc' } }, take: 20 }),
      ]);
      json(res, { totalSessions, totalPosts, categories, attention, topUsers });
    },
  },
  // ── Full post detail (with enrichment + MLKit) ────────────────────
  {
    method: 'GET',
    pattern: /^\/api\/post-detail/,
    handler: async (req, res) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const postId = url.searchParams.get('id');
      if (!postId) { json(res, { error: 'Missing id param' }, 400); return; }

      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { enrichment: true },
      });
      if (!post) { json(res, { error: 'Not found' }, 404); return; }
      json(res, post);
    },
  },
  // ── Enrichment endpoints ──────────────────────────────────────────
  {
    method: 'GET',
    pattern: /^\/api\/enrichment\/stats$/,
    handler: async (_req, res) => {
      const [totalPosts, totalEnriched, byPolitical, byNarrative, reviewFlagged] = await Promise.all([
        prisma.post.count(),
        prisma.postEnriched.count(),
        prisma.postEnriched.groupBy({ by: ['politicalExplicitnessScore'], _count: true, orderBy: { politicalExplicitnessScore: 'asc' } }),
        prisma.postEnriched.groupBy({ by: ['narrativeFrame'], _count: true, orderBy: { _count: { narrativeFrame: 'desc' } } }),
        prisma.postEnriched.count({ where: { reviewFlag: true } }),
      ]);

      // Aggregate polarization buckets
      const allEnriched = await prisma.postEnriched.findMany({
        select: {
          polarizationScore: true, mainTopics: true, confidenceScore: true,
          domains: true, tone: true, mediaCategory: true, mediaQuality: true,
          mediaIntent: true, provider: true, contentDomain: true,
          subjects: true, preciseSubjects: true,
        },
      });
      const polarBuckets = { low: 0, medium: 0, high: 0, extreme: 0 };
      let polarSum = 0;
      let confSum = 0;
      const topicCounts: Record<string, number> = {};
      const domainCounts: Record<string, number> = {};
      const toneCounts: Record<string, number> = {};
      const mediaCatCounts: Record<string, number> = {};
      const mediaIntentCounts: Record<string, number> = {};
      const providerCounts: Record<string, number> = {};
      let totalSubjects = 0;
      let totalPreciseSubjects = 0;

      for (const e of allEnriched) {
        const p = e.polarizationScore;
        polarSum += p;
        confSum += e.confidenceScore;
        if (p < 0.2) polarBuckets.low++;
        else if (p < 0.5) polarBuckets.medium++;
        else if (p < 0.8) polarBuckets.high++;
        else polarBuckets.extreme++;

        try {
          const topics = JSON.parse(e.mainTopics) as string[];
          for (const t of topics) { topicCounts[t] = (topicCounts[t] || 0) + 1; }
        } catch { /* ignore */ }

        try {
          const domains = JSON.parse(e.domains) as string[];
          for (const d of domains) { domainCounts[d] = (domainCounts[d] || 0) + 1; }
        } catch { /* ignore */ }

        if (e.tone) toneCounts[e.tone] = (toneCounts[e.tone] || 0) + 1;
        if (e.mediaCategory) mediaCatCounts[e.mediaCategory] = (mediaCatCounts[e.mediaCategory] || 0) + 1;
        if (e.mediaIntent) mediaIntentCounts[e.mediaIntent] = (mediaIntentCounts[e.mediaIntent] || 0) + 1;
        providerCounts[e.provider] = (providerCounts[e.provider] || 0) + 1;

        try { const s = JSON.parse(e.subjects) as unknown[]; totalSubjects += s.length; } catch { /* ignore */ }
        try { const ps = JSON.parse(e.preciseSubjects) as unknown[]; totalPreciseSubjects += ps.length; } catch { /* ignore */ }
      }

      const n = allEnriched.length || 1;
      const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
      const sortedDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
      const sortedTones = Object.entries(toneCounts).sort((a, b) => b[1] - a[1]);
      const sortedMediaCat = Object.entries(mediaCatCounts).sort((a, b) => b[1] - a[1]);
      const sortedMediaIntent = Object.entries(mediaIntentCounts).sort((a, b) => b[1] - a[1]);
      const sortedProviders = Object.entries(providerCounts).sort((a, b) => b[1] - a[1]);

      json(res, {
        totalPosts,
        totalEnriched,
        enrichmentRate: totalPosts > 0 ? Math.round(totalEnriched / totalPosts * 100) : 0,
        avgPolarization: Math.round(polarSum / n * 100) / 100,
        avgConfidence: Math.round(confSum / n * 100) / 100,
        reviewFlagged,
        byPolitical,
        byNarrative: byNarrative.filter(n => n.narrativeFrame !== ''),
        polarBuckets,
        topTopics,
        byDomain: sortedDomains,
        byTone: sortedTones,
        byMediaCategory: sortedMediaCat,
        byMediaIntent: sortedMediaIntent,
        byProvider: sortedProviders,
        totalSubjects,
        totalPreciseSubjects,
      });
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/enrichment\/posts$/,
    handler: async (req, res) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const politicalMin = parseInt(url.searchParams.get('political_min') || '0', 10);
      const politicalMax = parseInt(url.searchParams.get('political_max') || '4', 10);
      const narrative = url.searchParams.get('narrative') || undefined;
      const reviewOnly = url.searchParams.get('review') === '1';
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

      const where: any = {
        politicalExplicitnessScore: { gte: politicalMin, lte: politicalMax },
      };
      if (narrative) where.narrativeFrame = narrative;
      if (reviewOnly) where.reviewFlag = true;

      const posts = await prisma.postEnriched.findMany({
        where,
        take: limit,
        orderBy: { polarizationScore: 'desc' },
        include: { post: true },
      });

      json(res, posts);
    },
  },
  // ── Political axes aggregation ────────────────────────────────────
  {
    method: 'GET',
    pattern: /^\/api\/enrichment\/axes$/,
    handler: async (_req, res) => {
      const enriched = await prisma.postEnriched.findMany({
        select: {
          axisEconomic: true,
          axisSocietal: true,
          axisAuthority: true,
          axisSystem: true,
          dominantAxis: true,
          politicalExplicitnessScore: true,
        },
      });

      // Aggregate averages (only posts with signal, i.e. at least one axis != 0)
      let sumEco = 0, sumSoc = 0, sumAuth = 0, sumSys = 0;
      let withSignal = 0;
      const dominantCounts: Record<string, number> = {};

      for (const e of enriched) {
        const hasSignal = e.axisEconomic !== 0 || e.axisSocietal !== 0 || e.axisAuthority !== 0 || e.axisSystem !== 0;
        if (hasSignal) {
          withSignal++;
          sumEco += e.axisEconomic;
          sumSoc += e.axisSocietal;
          sumAuth += e.axisAuthority;
          sumSys += e.axisSystem;
        }
        if (e.dominantAxis) {
          dominantCounts[e.dominantAxis] = (dominantCounts[e.dominantAxis] || 0) + 1;
        }
      }

      const n = withSignal || 1;
      const round = (v: number) => Math.round(v * 100) / 100;

      // Distribution per axis: count negative / neutral / positive
      const distribution = {
        economic: { negative: 0, neutral: 0, positive: 0 },
        societal: { negative: 0, neutral: 0, positive: 0 },
        authority: { negative: 0, neutral: 0, positive: 0 },
        system: { negative: 0, neutral: 0, positive: 0 },
      };
      for (const e of enriched) {
        for (const axis of ['economic', 'societal', 'authority', 'system'] as const) {
          const key = `axis${axis.charAt(0).toUpperCase() + axis.slice(1)}` as keyof typeof e;
          const val = e[key] as number;
          if (val < -0.1) distribution[axis].negative++;
          else if (val > 0.1) distribution[axis].positive++;
          else distribution[axis].neutral++;
        }
      }

      json(res, {
        total: enriched.length,
        withSignal,
        averages: {
          economic: round(sumEco / n),
          societal: round(sumSoc / n),
          authority: round(sumAuth / n),
          system: round(sumSys / n),
        },
        dominantCounts,
        distribution,
      });
    },
  },
  // ── Debug history / session metrics ───────────────────────────────
  {
    method: 'GET',
    pattern: /^\/api\/debug\/history$/,
    handler: async (_req, res) => {
      const sessions = await prisma.session.findMany({
        where: { captureMode: 'visualizer-live' },
        orderBy: { capturedAt: 'desc' },
        take: 50,
        include: { metrics: true, _count: { select: { posts: true } } },
      });

      const history = sessions.map(s => ({
        sessionId: s.id,
        capturedAt: s.capturedAt,
        durationSec: s.durationSec,
        totalPosts: s.totalPosts,
        totalEvents: s.totalEvents,
        metrics: s.metrics ? {
          parseRate: s.metrics.parseRate,
          parseErrors: s.metrics.parseErrors,
          chunkSuccess: s.metrics.chunkSuccess,
          chunkFails: s.metrics.chunkFails,
          bridgeEvents: s.metrics.bridgeEvents,
          bridgeErrors: s.metrics.bridgeErrors,
          mlkitResults: s.metrics.mlkitResults,
          enrichedPosts: s.metrics.enrichedPosts,
          avgPoliticalScore: s.metrics.avgPoliticalScore,
          avgPolarization: s.metrics.avgPolarization,
          avgConfidence: s.metrics.avgConfidence,
        } : null,
      }));

      json(res, history);
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/debug\/session\/([^/]+)$/,
    handler: async (_req, res, params) => {
      const metrics = await prisma.sessionMetrics.findUnique({
        where: { sessionId: params.id },
      });
      if (!metrics) { json(res, { error: 'Not found' }, 404); return; }

      const enrichedPosts = await prisma.postEnriched.findMany({
        where: { post: { sessionId: params.id } },
        include: { post: { select: { username: true, caption: true, mediaType: true, dwellTimeMs: true } } },
        orderBy: { polarizationScore: 'desc' },
      });

      json(res, {
        metrics,
        errorLog: JSON.parse(metrics.errorLog || '[]'),
        enrichedPosts,
      });
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/enrichment-quality$/,
    handler: async (_req, res) => {
      const totalPosts = await prisma.post.count();
      const totalEnriched = await prisma.postEnriched.count();
      const emptyTopics = await prisma.postEnriched.count({
        where: { OR: [{ mainTopics: '[]' }, { mainTopics: '' }] },
      });
      const reviewFlags = await prisma.postEnriched.count({ where: { reviewFlag: true } });
      const rulesOnly = await prisma.postEnriched.count({ where: { provider: 'rules' } });
      const avgConf = await prisma.postEnriched.aggregate({ _avg: { confidenceScore: true } });
      const avgPol = await prisma.postEnriched.aggregate({ _avg: { polarizationScore: true } });

      // Confidence distribution
      const allEnriched = await prisma.postEnriched.findMany({
        select: { confidenceScore: true, mainTopics: true },
      });
      const confBuckets = { low: 0, medium: 0, good: 0, high: 0 };
      for (const e of allEnriched) {
        if (e.confidenceScore < 0.3) confBuckets.low++;
        else if (e.confidenceScore < 0.5) confBuckets.medium++;
        else if (e.confidenceScore < 0.7) confBuckets.good++;
        else confBuckets.high++;
      }

      // Theme coverage
      const topicCount: Record<string, number> = {};
      for (const e of allEnriched) {
        try {
          const topics: string[] = JSON.parse(e.mainTopics);
          for (const t of topics) topicCount[t] = (topicCount[t] || 0) + 1;
        } catch { /* skip */ }
      }
      const themesWithPosts = Object.keys(topicCount).length;
      const themesAbove5 = Object.values(topicCount).filter(c => c >= 5).length;

      json(res, {
        totalPosts,
        totalEnriched,
        emptyTopicsCount: emptyTopics,
        emptyTopicsRate: totalEnriched > 0 ? Math.round(emptyTopics / totalEnriched * 1000) / 10 : 0,
        reviewFlags,
        rulesOnly,
        llmEnriched: totalEnriched - rulesOnly,
        avgConfidence: avgConf._avg.confidenceScore ? Math.round(avgConf._avg.confidenceScore * 1000) / 1000 : null,
        avgPolarization: avgPol._avg.polarizationScore ? Math.round(avgPol._avg.polarizationScore * 1000) / 1000 : null,
        confidenceDistribution: confBuckets,
        themeCoverage: { total: 24, withPosts: themesWithPosts, above5Posts: themesAbove5 },
        topicDistribution: Object.entries(topicCount).sort((a, b) => b[1] - a[1]),
      });
    },
  },
];

// ── Mobile sync proxy ─────────────────────────────────────────────
// These routes forward to the mobile HTTP server if connected.
// Set via setMobileSyncClient() from server.ts when mobile is detected.

let mobileBaseUrl: string | null = null;

export function setMobileSyncUrl(url: string | null): void {
  mobileBaseUrl = url;
}

async function proxyToMobile(path: string, res: ServerResponse): Promise<boolean> {
  if (!mobileBaseUrl) {
    json(res, { error: 'Mobile not connected' }, 503);
    return true;
  }
  try {
    const mobileRes = await fetch(`${mobileBaseUrl}${path}`);
    const data = await mobileRes.text();
    res.writeHead(mobileRes.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(data);
    return true;
  } catch {
    json(res, { error: 'Mobile unreachable' }, 502);
    return true;
  }
}

const mobileRoutes: Array<{ pattern: RegExp; mobilePath: (match: RegExpMatchArray) => string }> = [
  { pattern: /^\/api\/mobile\/sessions$/, mobilePath: () => '/api/sessions' },
  { pattern: /^\/api\/mobile\/sessions\/([^/]+)\/posts/, mobilePath: (m) => `/api/sessions/${m[1]}/posts` },
  { pattern: /^\/api\/mobile\/stats$/, mobilePath: () => '/api/stats' },
  { pattern: /^\/api\/mobile\/posts$/, mobilePath: () => '/api/posts' },
  { pattern: /^\/api\/mobile\/export\/([^/]+)$/, mobilePath: (m) => `/api/export/${m[1]}` },
  { pattern: /^\/api\/mobile\/health$/, mobilePath: () => '/api/health' },
];

export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  const method = req.method || 'GET';

  // Mobile proxy routes
  if (url.startsWith('/api/mobile/') && method === 'GET') {
    for (const mr of mobileRoutes) {
      const mm = url.match(mr.pattern);
      if (mm) return proxyToMobile(mr.mobilePath(mm), res);
    }
  }

  const pathname = url.split('?')[0];

  for (const route of routes) {
    if (route.method !== method) continue;
    const match = pathname.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      if (match[1]) params.id = decodeURIComponent(match[1]);
      try {
        await route.handler(req, res, params);
      } catch (err) {
        console.error(`[api] Error ${url}:`, err);
        json(res, { error: 'Internal server error' }, 500);
      }
      return true;
    }
  }
  return false;
}
