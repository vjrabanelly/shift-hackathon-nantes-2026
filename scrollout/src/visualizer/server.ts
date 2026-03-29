/**
 * ECHA Visualizer Server — HTTP + WebSocket + live ingest.
 * Usage: npx tsx src/visualizer/server.ts
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { LogcatTap, EchaEvent, MLKitResult, SessionSummary, TrackerEvent } from '../logcat-tap';
import { handleApi, setMobileSyncUrl } from './api';
import { connectToMobile } from '../mobile-sync/client';
import prisma from '../db/client';
import { normalizePostText } from '../enrichment/normalize';
import { applyRules, RulesResult } from '../enrichment/rules-engine';

const PORT = parseInt(process.env.VISUALIZER_PORT || '3000', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');

// ─── Live session state ─────────────────────────────────────────────

let liveSessionId: string | null = null;
let liveSessionStart = 0;
let liveEventCount = 0;
let liveBridgeEvents = 0;
let liveBridgeErrors = 0;
const livePostMap = new Map<string, { username: string; dwellTimeMs: number; lastSeen: number }>();
const liveErrorLog: { ts: number; message: string; context: string }[] = [];

async function ensureLiveSession(): Promise<string> {
  if (liveSessionId) return liveSessionId;
  liveSessionStart = Date.now();
  liveSessionId = String(liveSessionStart);

  await prisma.session.create({
    data: {
      id: liveSessionId,
      capturedAt: new Date(),
      durationSec: 0,
      totalEvents: 0,
      totalPosts: 0,
      captureMode: 'visualizer-live',
    },
  });

  console.log(`[visualizer] Live session created: ${liveSessionId}`);
  return liveSessionId;
}

async function ingestEvent(event: EchaEvent): Promise<void> {
  const sessionId = await ensureLiveSession();
  liveEventCount++;

  // Update session stats periodically
  if (liveEventCount % 10 === 0) {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        durationSec: (Date.now() - liveSessionStart) / 1000,
        totalEvents: liveEventCount,
        totalPosts: livePostMap.size,
      },
    });
  }

  // Upsert posts from visiblePosts
  if (event.focusedPost) {
    const post = event.focusedPost;
    const postKey = `${sessionId}:${post.username}:${post.postId}`;
    const existing = livePostMap.get(postKey);
    const dwellMs = event.dwellTimes?.[event.focusedPostId] || 0;

    livePostMap.set(postKey, {
      username: post.username,
      dwellTimeMs: dwellMs,
      lastSeen: event.timestamp,
    });

    if (!existing) {
      try {
        await prisma.post.create({
          data: {
            id: postKey,
            sessionId,
            username: post.username,
            caption: post.caption || '',
            imageDesc: post.imageDescription || '',
            mediaType: post.mediaType || 'photo',
            likeCount: parseInt(post.likeCount?.replace(/[^\d]/g, '') || '0', 10) || 0,
            dateLabel: post.date || '',
            isSponsored: post.isSponsored || false,
            isSuggested: post.isSuggested || false,
            dwellTimeMs: dwellMs,
            attentionLevel: classifyAttention(dwellMs),
            allText: [post.username, post.caption, post.imageDescription].filter(Boolean).join(' '),
            firstSeenAt: event.timestamp,
            lastSeenAt: event.timestamp,
          },
        });
      } catch { /* duplicate key — ignore */ }
    } else {
      try {
        await prisma.post.update({
          where: { id: postKey },
          data: {
            dwellTimeMs: dwellMs,
            attentionLevel: classifyAttention(dwellMs),
            lastSeenAt: event.timestamp,
            seenCount: { increment: 1 },
          },
        });
      } catch { /* not found — ignore */ }
    }
  }
}

function classifyAttention(ms: number): string {
  if (ms < 500) return 'skipped';
  if (ms < 2000) return 'glanced';
  if (ms < 5000) return 'viewed';
  return 'engaged';
}

// ─── Real-time enrichment ───────────────────────────────────────────

const enrichmentCache = new Map<string, RulesResult & { normalizedText: string; language: string }>();

function enrichPost(post: {
  username: string;
  caption?: string;
  imageDescription?: string;
  allText?: string;
  isSponsored?: boolean;
}, postId: string): void {
  if (enrichmentCache.has(postId)) return;

  const caption = post.caption || '';
  const imageDesc = post.imageDescription || '';
  const allText = post.allText || [post.username, caption, imageDesc].filter(Boolean).join(' ');

  // Extract hashtags from caption
  const hashtags = (caption.match(/#[\w\u00C0-\u024F]+/g) || []).map(h => h.replace('#', ''));

  // Normalize text
  const { normalizedText, language } = normalizePostText({
    caption,
    imageDesc,
    allText,
    hashtags,
  });

  // Apply rules engine
  const rules = applyRules({
    normalizedText,
    hashtags,
    username: post.username || '',
    isSponsored: post.isSponsored || false,
  });

  const result = { ...rules, normalizedText, language };
  enrichmentCache.set(postId, result);

  const enrichData = {
    normalizedText: normalizedText.substring(0, 500),
    language,
    mainTopics: rules.mainTopics,
    secondaryTopics: rules.secondaryTopics,
    politicalScore: rules.politicalExplicitnessScore,
    politicalIssueTags: rules.politicalIssueTags,
    politicalActors: rules.politicalActors,
    institutions: rules.institutions,
    activismSignal: rules.activismSignal,
    polarizationScore: rules.polarizationScore,
    conflictSignal: rules.conflictSignal,
    ingroupOutgroupSignal: rules.ingroupOutgroupSignal,
    moralAbsoluteSignal: rules.moralAbsoluteSignal,
    enemyDesignationSignal: rules.enemyDesignationSignal,
    politicalAxes: rules.politicalAxes,
    dominantAxis: rules.dominantAxis,
    mediaCategory: rules.mediaCategory,
    mediaQuality: rules.mediaQuality,
    confidenceScore: rules.confidenceScore,
  };

  broadcast({ type: 'enrichment', postId, data: enrichData });

  // Persist enrichment to DB
  persistEnrichment(postId, rules, normalizedText, hashtags).catch(() => {});
}

async function persistEnrichment(
  postId: string,
  rules: RulesResult,
  normalizedText: string,
  hashtags: string[],
): Promise<void> {
  try {
    await prisma.postEnriched.upsert({
      where: { postId },
      create: {
        postId,
        provider: 'rules',
        model: 'rules-v1',
        version: '1',
        normalizedText,
        keywordTerms: JSON.stringify(hashtags),
        mainTopics: JSON.stringify(rules.mainTopics),
        secondaryTopics: JSON.stringify(rules.secondaryTopics),
        politicalActors: JSON.stringify(rules.politicalActors),
        institutions: JSON.stringify(rules.institutions),
        activismSignal: rules.activismSignal,
        politicalExplicitnessScore: rules.politicalExplicitnessScore,
        politicalIssueTags: JSON.stringify(rules.politicalIssueTags),
        polarizationScore: rules.polarizationScore,
        ingroupOutgroupSignal: rules.ingroupOutgroupSignal,
        conflictSignal: rules.conflictSignal,
        moralAbsoluteSignal: rules.moralAbsoluteSignal,
        enemyDesignationSignal: rules.enemyDesignationSignal,
        axisEconomic: rules.politicalAxes.economic,
        axisSocietal: rules.politicalAxes.societal,
        axisAuthority: rules.politicalAxes.authority,
        axisSystem: rules.politicalAxes.system,
        dominantAxis: rules.dominantAxis || '',
        mediaCategory: rules.mediaCategory,
        mediaQuality: rules.mediaQuality,
        confidenceScore: rules.confidenceScore,
      },
      update: {
        normalizedText,
        mainTopics: JSON.stringify(rules.mainTopics),
        secondaryTopics: JSON.stringify(rules.secondaryTopics),
        politicalActors: JSON.stringify(rules.politicalActors),
        institutions: JSON.stringify(rules.institutions),
        activismSignal: rules.activismSignal,
        politicalExplicitnessScore: rules.politicalExplicitnessScore,
        politicalIssueTags: JSON.stringify(rules.politicalIssueTags),
        polarizationScore: rules.polarizationScore,
        ingroupOutgroupSignal: rules.ingroupOutgroupSignal,
        conflictSignal: rules.conflictSignal,
        moralAbsoluteSignal: rules.moralAbsoluteSignal,
        enemyDesignationSignal: rules.enemyDesignationSignal,
        axisEconomic: rules.politicalAxes.economic,
        axisSocietal: rules.politicalAxes.societal,
        axisAuthority: rules.politicalAxes.authority,
        axisSystem: rules.politicalAxes.system,
        dominantAxis: rules.dominantAxis || '',
        mediaCategory: rules.mediaCategory,
        mediaQuality: rules.mediaQuality,
        confidenceScore: rules.confidenceScore,
        updatedAt: new Date(),
      },
    });
  } catch { /* post may not exist in DB yet — skip silently */ }
}

async function finalizeLiveSession(): Promise<void> {
  if (!liveSessionId) return;
  try {
    const metrics = tap.getMetrics();

    // Compute enrichment averages
    let totalPol = 0, totalPolar = 0, totalConf = 0;
    for (const e of enrichmentCache.values()) {
      totalPol += e.politicalExplicitnessScore;
      totalPolar += e.polarizationScore;
      totalConf += e.confidenceScore;
    }
    const enrichCount = enrichmentCache.size;

    await prisma.session.update({
      where: { id: liveSessionId },
      data: {
        durationSec: (Date.now() - liveSessionStart) / 1000,
        totalEvents: liveEventCount,
        totalPosts: livePostMap.size,
      },
    });

    // Persist session metrics
    await prisma.sessionMetrics.upsert({
      where: { sessionId: liveSessionId },
      create: {
        sessionId: liveSessionId,
        totalLines: metrics.totalLines,
        parsedEvents: metrics.parsedEvents,
        parseErrors: metrics.parseErrors,
        parseRate: metrics.parseRate,
        chunkSuccess: metrics.chunkSuccess,
        chunkFails: metrics.chunkFails,
        bridgeEvents: liveBridgeEvents,
        bridgeErrors: liveBridgeErrors,
        mlkitResults: metrics.mlkitResults,
        enrichedPosts: enrichCount,
        avgPoliticalScore: enrichCount > 0 ? totalPol / enrichCount : 0,
        avgPolarization: enrichCount > 0 ? totalPolar / enrichCount : 0,
        avgConfidence: enrichCount > 0 ? totalConf / enrichCount : 0,
        errorLog: JSON.stringify(liveErrorLog.slice(-100)),
      },
      update: {
        totalLines: metrics.totalLines,
        parsedEvents: metrics.parsedEvents,
        parseErrors: metrics.parseErrors,
        parseRate: metrics.parseRate,
        chunkSuccess: metrics.chunkSuccess,
        chunkFails: metrics.chunkFails,
        bridgeEvents: liveBridgeEvents,
        bridgeErrors: liveBridgeErrors,
        mlkitResults: metrics.mlkitResults,
        enrichedPosts: enrichCount,
        avgPoliticalScore: enrichCount > 0 ? totalPol / enrichCount : 0,
        avgPolarization: enrichCount > 0 ? totalPolar / enrichCount : 0,
        avgConfidence: enrichCount > 0 ? totalConf / enrichCount : 0,
        errorLog: JSON.stringify(liveErrorLog.slice(-100)),
      },
    });

    console.log(`[visualizer] Session ${liveSessionId} finalized: ${livePostMap.size} posts, ${liveEventCount} events, ${enrichCount} enriched`);
    console.log(`[visualizer] Metrics — parse:${metrics.parseRate}% chunks:${metrics.chunkSuccess}/${metrics.chunkSuccess + metrics.chunkFails} errors:${metrics.parseErrors} bridge:${liveBridgeEvents}/${liveBridgeErrors}`);
  } catch (e) {
    console.error('[visualizer] Failed to finalize session:', e);
  }
}

// ─── MIME types ──────────────────────────────────────────────────────

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// ─── HTTP Server ─────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  // API routes
  if (url.startsWith('/api/')) {
    const handled = await handleApi(req, res);
    if (handled) return;
  }

  // Live stats endpoint
  if (url === '/api/live/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      sessionId: liveSessionId,
      durationSec: liveSessionId ? (Date.now() - liveSessionStart) / 1000 : 0,
      postCount: livePostMap.size,
      eventCount: liveEventCount,
      metrics: tap.getMetrics(),
    }));
    return;
  }

  // Static files
  let filePath = url === '/' ? '/index.html' : url;
  filePath = path.join(PUBLIC_DIR, filePath);

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'text/plain';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

// ─── WebSocket Server ────────────────────────────────────────────────

const wss = new WebSocketServer({ server });
wss.on('error', () => { /* handled by server error handler */ });

function broadcast(message: object): void {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// ─── Mobile WebSocket tracking ──────────────────────────────────────

let mobileWs: WebSocket | null = null;
let _mobileConnectedAt = 0;

function _isMobileSource(ws: WebSocket, req: { headers: Record<string, string | string[] | undefined> }): boolean {
  return req.headers['x-echa-source'] === 'mobile';
}

interface MobilePostData {
  sessionId: string;
  post: {
    postId: string;
    username: string;
    caption?: string;
    fullCaption?: string;
    imageAlts?: string;
    imageUrls?: string;
    mediaType?: string;
    likeCount?: string;
    isSponsored?: boolean;
    isSuggested?: boolean;
    dwellTimeMs?: number;
    allText?: string;
    date?: string;
    location?: string;
    hashtags?: string;
  };
}

interface MobileDwellData {
  sessionId: string;
  postId: string;
  username: string;
  dwellTimeMs: number;
}

interface MobileSessionData {
  sessionId: string;
  captureMode?: string;
  durationSec?: number;
  totalPosts?: number;
  totalEvents?: number;
  timestamp?: number;
}

async function handleMobileMessage(raw: string): Promise<void> {
  let msg: { type: string; data: any };
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  const { type, data } = msg;

  switch (type) {
    case 'mobile:hello': {
      console.log(`[visualizer] Mobile hello — sessions:${data?.totalSessions} posts:${data?.totalPosts} enriched:${data?.totalEnriched}`);
      broadcast({ type: 'status', mobile: 'connected', stats: data });
      break;
    }

    case 'mobile:session-start': {
      const d = data as MobileSessionData;
      console.log(`[visualizer] Mobile session started: ${d.sessionId} (${d.captureMode})`);
      // Create session in Prisma if it doesn't exist
      try {
        await prisma.session.upsert({
          where: { id: d.sessionId },
          create: {
            id: d.sessionId,
            capturedAt: new Date(d.timestamp || Date.now()),
            durationSec: 0,
            totalEvents: 0,
            totalPosts: 0,
            captureMode: d.captureMode || 'mobile-ws',
          },
          update: {},
        });
      } catch { /* ignore */ }
      broadcast({ type: 'mobile-session-start', data: d });
      break;
    }

    case 'mobile:session-end': {
      const d = data as MobileSessionData;
      console.log(`[visualizer] Mobile session ended: ${d.sessionId} — ${d.totalPosts} posts, ${d.durationSec?.toFixed(0)}s`);
      try {
        await prisma.session.update({
          where: { id: d.sessionId },
          data: {
            durationSec: d.durationSec || 0,
            totalPosts: d.totalPosts || 0,
            totalEvents: d.totalEvents || 0,
          },
        });
      } catch { /* ignore */ }
      broadcast({ type: 'mobile-session-end', data: d });
      break;
    }

    case 'mobile:post': {
      const d = data as MobilePostData;
      const post = d.post;
      const postKey = `${d.sessionId}:${post.username}:${post.postId}`;

      // Ensure session exists
      await ensureMobileSession(d.sessionId);

      // Parse hashtags
      let _hashtags: string[] = [];
      try { _hashtags = JSON.parse(post.hashtags || '[]'); } catch { /* ignore */ }

      // Upsert post in Prisma
      try {
        await prisma.post.upsert({
          where: { id: postKey },
          create: {
            id: postKey,
            sessionId: d.sessionId,
            username: post.username || '',
            caption: post.fullCaption || post.caption || '',
            imageDesc: '',
            mediaType: post.mediaType || 'photo',
            likeCount: parseInt(String(post.likeCount || '0').replace(/[^\d]/g, ''), 10) || 0,
            dateLabel: post.date || '',
            isSponsored: post.isSponsored || false,
            isSuggested: post.isSuggested || false,
            dwellTimeMs: post.dwellTimeMs || 0,
            attentionLevel: classifyAttention(post.dwellTimeMs || 0),
            allText: post.allText || [post.username, post.caption].filter(Boolean).join(' '),
            firstSeenAt: Date.now(),
            lastSeenAt: Date.now(),
          },
          update: {
            caption: post.fullCaption || post.caption || undefined,
            dwellTimeMs: post.dwellTimeMs || undefined,
            attentionLevel: post.dwellTimeMs ? classifyAttention(post.dwellTimeMs) : undefined,
            lastSeenAt: Date.now(),
            seenCount: { increment: 1 },
          },
        });
      } catch { /* ignore */ }

      // Broadcast to dashboard clients
      broadcast({
        type: 'event',
        source: 'mobile',
        data: {
          focusedPost: {
            username: post.username,
            caption: post.fullCaption || post.caption,
            mediaType: post.mediaType,
            isSponsored: post.isSponsored,
            isSuggested: post.isSuggested,
            postId: post.postId,
          },
          focusedPostId: postKey,
          timestamp: Date.now(),
          dwellTimes: { [postKey]: post.dwellTimeMs || 0 },
        },
      });

      // Real-time enrichment
      try {
        const caption = post.fullCaption || post.caption || '';
        enrichPost({
          username: post.username || '',
          caption,
          allText: post.allText || [post.username, caption].filter(Boolean).join(' '),
        }, postKey);
      } catch { /* ignore */ }

      break;
    }

    case 'mobile:dwell': {
      const d = data as MobileDwellData;
      const postKey = `${d.sessionId}:${d.username}:${d.postId}`;
      try {
        await prisma.post.update({
          where: { id: postKey },
          data: {
            dwellTimeMs: d.dwellTimeMs,
            attentionLevel: classifyAttention(d.dwellTimeMs),
            lastSeenAt: Date.now(),
          },
        });
      } catch { /* post may not exist yet */ }

      broadcast({
        type: 'event',
        source: 'mobile',
        data: {
          focusedPostId: postKey,
          timestamp: Date.now(),
          dwellTimes: { [postKey]: d.dwellTimeMs },
        },
      });
      break;
    }

    case 'mobile:mlkit': {
      broadcast({ type: 'mlkit', source: 'mobile', data });
      break;
    }

    case 'mobile:enrichment': {
      broadcast({ type: 'enrichment', source: 'mobile', postId: data.postId, data: data.enrichment });
      break;
    }

    case 'mobile:pong': {
      // Keepalive response — nothing to do
      break;
    }
  }
}

async function ensureMobileSession(sessionId: string): Promise<void> {
  try {
    const exists = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!exists) {
      await prisma.session.create({
        data: {
          id: sessionId,
          capturedAt: new Date(),
          durationSec: 0,
          totalEvents: 0,
          totalPosts: 0,
          captureMode: 'mobile-ws',
        },
      });
    }
  } catch { /* race condition — ignore */ }
}

async function handleDashboardMessage(ws: WebSocket, raw: string): Promise<void> {
  let msg: { type: string; postId?: string };
  try { msg = JSON.parse(raw); } catch { return; }

  if (msg.type === 'request-post-detail' && msg.postId) {
    const post = await prisma.post.findUnique({
      where: { id: msg.postId },
      include: { enrichment: true },
    });
    if (post) {
      ws.send(JSON.stringify({ type: 'post-detail', postId: msg.postId, data: post }));
    }
  }
}

wss.on('connection', (ws, req) => {
  const isMobile = req.headers['x-echa-source'] === 'mobile';

  if (isMobile) {
    mobileWs = ws;
    _mobileConnectedAt = Date.now();
    console.log(`[visualizer] Mobile device connected via WebSocket`);
    broadcast({ type: 'status', mobile: 'connected' });
  } else {
    console.log(`[visualizer] Dashboard client connected (${wss.clients.size} total)`);
  }

  // Send current state to dashboard clients
  if (!isMobile) {
    ws.send(JSON.stringify({ type: 'status', adb: tap ? 'connected' : 'disconnected', mobile: mobileWs?.readyState === WebSocket.OPEN ? 'connected' : 'disconnected' }));
    ws.send(JSON.stringify({ type: 'quality', metrics: tap.getMetrics() }));
  }

  ws.on('message', (rawData) => {
    const raw = rawData.toString();
    if (isMobile) {
      handleMobileMessage(raw).catch(e => {
        console.error('[visualizer] Mobile message error:', e);
      });
    } else {
      // Dashboard client messages
      handleDashboardMessage(ws, raw).catch(() => {});
    }
  });

  ws.on('close', () => {
    if (isMobile) {
      mobileWs = null;
      console.log(`[visualizer] Mobile device disconnected`);
      broadcast({ type: 'status', mobile: 'disconnected' });
    } else {
      console.log(`[visualizer] Dashboard client disconnected (${wss.clients.size} total)`);
    }
  });
});

// ─── Logcat Tap ──────────────────────────────────────────────────────

const tap = new LogcatTap();

tap.on('event', async (event: EchaEvent) => {
  broadcast({ type: 'event', data: event });
  try {
    await ingestEvent(event);
    broadcast({ type: 'db-update', table: 'post', id: event.focusedPostId });
  } catch (e) {
    console.error('[visualizer] Ingest error:', e);
  }

  // Real-time enrichment
  if (event.focusedPost) {
    const post = event.focusedPost;
    const postId = event.focusedPostId || post.username;
    try {
      enrichPost(post as { username: string; caption?: string; imageDescription?: string; allText?: string }, postId);
    } catch (e) {
      console.error('[visualizer] Enrichment error:', e);
    }
  }
});

tap.on('mlkit', (data: MLKitResult) => {
  broadcast({ type: 'mlkit', data });
});

tap.on('summary', (data: SessionSummary) => {
  broadcast({ type: 'summary', data });
});

tap.on('tracker', (data: TrackerEvent) => {
  liveBridgeEvents++;
  broadcast({ type: 'tracker', data });

  // Enrich tracker posts too
  if (data.post?.data) {
    const d = data.post.data;
    try {
      enrichPost({
        username: d.username || '',
        caption: d.fullCaption || d.caption || '',
        imageDescription: d.imageAlts?.join(' ') || '',
        allText: d.allText || '',
      }, data.post.postId);
    } catch { /* ignore */ }
  }
});

tap.on('raw', (line: string) => {
  broadcast({ type: 'raw', line });
});

tap.on('error', (err: { message: string; context: string }) => {
  broadcast({ type: 'error', message: err.message, context: err.context });
  liveErrorLog.push({ ts: Date.now(), message: err.message, context: err.context });
  if (err.message.includes('Bridge')) liveBridgeErrors++;
});

tap.on('status', (status: string) => {
  broadcast({ type: 'status', adb: status });
  console.log(`[visualizer] ADB ${status}`);
});

// Quality metrics broadcast every 3s
setInterval(() => {
  broadcast({ type: 'quality', metrics: tap.getMetrics() });
}, 3000);

// ─── Start ───────────────────────────────────────────────────────────

function startServer(port: number): void {
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[visualizer] Port ${port} in use, killing existing process...`);
      import('child_process').then(({ execSync }) => {
        try {
          // Find and kill the process holding the port (Windows)
          const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' });
          const pids = new Set(
            result.trim().split('\n')
              .map(line => line.trim().split(/\s+/).pop())
              .filter((pid): pid is string => !!pid && pid !== '0')
          );
          for (const pid of pids) {
            try { execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' }); } catch { /* already dead */ }
          }
          console.log(`[visualizer] Killed process(es) on port ${port}, retrying...`);
          setTimeout(() => startServer(port), 1000);
        } catch {
          console.error(`[visualizer] Failed to free port ${port}. Please kill the process manually.`);
          process.exit(1);
        }
      });
    } else {
      console.error(`[visualizer] Server error:`, err);
      process.exit(1);
    }
  });

  server.listen(port, async () => {
    console.log(`\n  ╔══════════════════════════════════════╗`);
    console.log(`  ║  Scrollout Debug Visualizer           ║`);
    console.log(`  ║  http://localhost:${port}               ║`);
    console.log(`  ╚══════════════════════════════════════╝\n`);

    // Setup ADB reverse so mobile can reach our WS server
    try {
      const { execSync } = await import('child_process');
      const { findAdbPath } = await import('../adb-path');
      const adb = findAdbPath();
      execSync(`"${adb}" reverse tcp:${port} tcp:${port}`, { stdio: 'ignore' });
      console.log(`[visualizer] ADB reverse tcp:${port} → tcp:${port} (mobile can reach ws://localhost:${port})`);
    } catch {
      console.log(`[visualizer] ADB reverse failed — mobile WS will need direct IP connection`);
    }

    // Try to connect to mobile HTTP API (fallback for REST queries)
    const mobilePort = parseInt(process.env.MOBILE_PORT || '8765', 10);
    const mobile = await connectToMobile(mobilePort);
    if (mobile) {
      setMobileSyncUrl(`http://localhost:${mobilePort}`);
      console.log(`[visualizer] Mobile HTTP connected — /api/mobile/* routes active`);
      const stats = await mobile.getStats();
      console.log(`[visualizer] Mobile DB: ${stats.totalSessions} sessions, ${stats.totalPosts} posts, ${stats.totalEnriched} enriched`);
    } else {
      console.log(`[visualizer] Mobile HTTP not available — waiting for WebSocket connection`);
    }

    console.log(`[visualizer] Starting ADB logcat...`);
    tap.start();
  });
}

startServer(PORT);

// ─── Graceful shutdown ───────────────────────────────────────────────

async function shutdown(): Promise<void> {
  console.log('\n[visualizer] Shutting down...');
  tap.stop();
  await finalizeLiveSession();
  await prisma.$disconnect();
  wss.close();
  server.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
