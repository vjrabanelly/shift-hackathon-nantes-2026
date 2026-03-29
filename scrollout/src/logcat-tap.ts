/**
 * ECHA LogcatTap — EventEmitter-based logcat listener.
 * Listens to ECHA_DATA + ECHA_MLKIT tags, parses events, tracks quality.
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { findAdbPath } from './adb-path';

export interface VisiblePost {
  postId: string;
  username: string;
  caption: string;
  imageDescription: string;
  likeCount: string;
  date: string;
  mediaType: string;
  carouselCount?: number;
  isSponsored: boolean;
  isSuggested: boolean;
  videoUrl?: string;
}

export interface EchaEvent {
  timestamp: number;
  eventType: string;
  screenType: string;
  nodeCount: number;
  focusedPostId: string;
  focusedPost: VisiblePost | null;
  visiblePosts: VisiblePost[];
  dwellTimes: Record<string, number>;
  nodes: unknown[];
  imageDescriptions: string[];
}

export interface SessionSummary {
  type: string;
  timestamp: number;
  totalPostsViewed: number;
  posts: Array<{
    postId: string;
    dwellTimeMs: number;
    dwellTimeSec: number;
    metadata?: VisiblePost;
  }>;
}

export interface MLKitResult {
  postId: string;
  labels: Array<{ text: string; confidence: number }>;
  ocrText: string;
  processingMs: number;
}

/** WebView tracker.js event (via EchaBridge → ECHA_INSTA logcat) */
export interface TrackerEvent {
  type: 'new_post' | 'post_update' | 'session_summary' | 'log';
  post?: {
    postId: string;
    firstSeen: number;
    lastSeen: number;
    dwellTimeMs: number;
    dwellTimeSec?: number;
    seenCount: number;
    data: {
      username: string;
      displayName: string;
      caption: string;
      fullCaption: string;
      hashtags: string[];
      imageUrls: string[];
      imageAlts: string[];
      videoUrl: string;
      likeCount: string;
      commentCount: string;
      date: string;
      mediaType: string;
      isSponsored: boolean;
      isSuggested: boolean;
      isReel: boolean;
      location: string;
      audioTrack: string;
    };
  };
  // session_summary fields
  timestamp?: number;
  sessionDurationSec?: number;
  totalPosts?: number;
  posts?: Array<{
    postId: string;
    firstSeen: number;
    lastSeen: number;
    dwellTimeMs: number;
    seenCount: number;
    data: Record<string, unknown>;
  }>;
  message?: string;
}

export interface QualityMetrics {
  totalLines: number;
  parsedEvents: number;
  parseErrors: number;
  chunkSuccess: number;
  chunkFails: number;
  mlkitResults: number;
  parseRate: number;
  eventsPerSec: number;
  missingFields: Record<string, number>;
}

export class LogcatTap extends EventEmitter {
  private logcat: ChildProcess | null = null;
  private chunkBuffer: string[] = [];
  private expectedChunks = 0;
  private chunkBuffers = new Map<number, { buffer: string[]; total: number; ts: number }>();
  private bridgeChunks = new Map<number, { buffer: string[]; total: number }>();
  private startTime = Date.now();
  private metrics: QualityMetrics = {
    totalLines: 0,
    parsedEvents: 0,
    parseErrors: 0,
    chunkSuccess: 0,
    chunkFails: 0,
    mlkitResults: 0,
    parseRate: 100,
    eventsPerSec: 0,
    missingFields: {},
  };

  start(): void {
    const adbPath = findAdbPath();
    const attachOutput = (proc: ChildProcess): void => {
      proc.stdout?.on('data', (data: Buffer) => {
        for (const line of data.toString('utf-8').split('\n')) {
          const trimmed = line.trim();
          if (trimmed) this.processLine(trimmed);
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) this.emit('error', { message: msg, context: 'adb-stderr' });
      });
    };

    // First replay the existing buffer so the dashboard can recover after disconnects.
    const dump = spawn(adbPath, [
      'logcat', '-d', '-s', 'ECHA_DATA:I', 'ECHA_INSTA:I', 'ECHA_MLKIT:I', '*:S', '-v', 'raw',
    ]);
    attachOutput(dump);

    dump.on('close', () => {
      // Then keep following live output without clearing the buffer.
      this.logcat = spawn(adbPath, [
        'logcat', '-T', '1', '-s', 'ECHA_DATA:I', 'ECHA_INSTA:I', 'ECHA_MLKIT:I', '*:S', '-v', 'raw',
      ]);

      attachOutput(this.logcat);

      this.logcat.on('close', (code) => {
        this.emit('status', 'disconnected');
        if (code !== 0 && code !== null) {
          this.emit('error', { message: `ADB exited with code ${code}`, context: 'adb-exit' });
        }
      });

      this.emit('status', 'connected');
    });
  }

  stop(): void {
    if (this.logcat) {
      this.logcat.kill();
      this.logcat = null;
    }
  }

  getMetrics(): QualityMetrics {
    const elapsed = (Date.now() - this.startTime) / 1000;
    this.metrics.parseRate = this.metrics.totalLines > 0
      ? Math.round((this.metrics.parsedEvents / this.metrics.totalLines) * 100)
      : 100;
    this.metrics.eventsPerSec = elapsed > 0
      ? Math.round((this.metrics.parsedEvents / elapsed) * 10) / 10
      : 0;
    return { ...this.metrics };
  }

  private processLine(line: string): void {
    if (line.startsWith('-----')) return;
    this.metrics.totalLines++;

    this.emit('raw', line);

    // Service lifecycle
    if (line.startsWith('SERVICE_')) return;

    // WebView bridge events — single-line
    if (line.startsWith('BRIDGE_DATA|')) {
      this.handleBridgeData(line.substring(12));
      return;
    }

    // WebView bridge events — chunked (format: BRIDGE_CHUNK|seq|index|total|data)
    if (line.startsWith('BRIDGE_CHUNK|')) {
      const parts = line.split('|');
      if (parts.length >= 5) {
        const seq = parseInt(parts[1], 10);
        const index = parseInt(parts[2], 10);
        const total = parseInt(parts[3], 10);
        if (!this.bridgeChunks.has(seq)) {
          this.bridgeChunks.set(seq, { buffer: new Array(total).fill(''), total });
        }
        const entry = this.bridgeChunks.get(seq)!;
        entry.buffer[index] = parts.slice(4).join('|');
      }
      return;
    }

    if (line.startsWith('BRIDGE_END|')) {
      const seq = parseInt(line.substring(11), 10);
      const entry = this.bridgeChunks.get(seq);
      if (entry && entry.buffer.every(c => c !== '')) {
        this.handleBridgeData(entry.buffer.join(''));
        this.metrics.chunkSuccess++;
      } else if (entry) {
        this.metrics.chunkFails++;
        const missing = entry.buffer.filter(c => c === '').length;
        this.emit('error', { message: `Bridge chunk incomplete: ${missing}/${entry.total} missing`, context: 'bridge-chunk' });
      }
      this.bridgeChunks.delete(seq);
      // Clean old entries (stale chunks from >30s ago)
      if (this.bridgeChunks.size > 10) {
        const oldest = [...this.bridgeChunks.keys()].slice(0, this.bridgeChunks.size - 5);
        for (const k of oldest) this.bridgeChunks.delete(k);
      }
      return;
    }

    // Legacy bridge format (pre-chunking) — skip truncated data
    if (line.startsWith('Bridge data: ')) {
      return;
    }

    // MLKit results
    if (line.startsWith('MLKIT|') || line.startsWith('ECHA_MLKIT|')) {
      this.handleMLKit(line);
      return;
    }

    // Session summaries
    if (line.startsWith('SUMMARY|')) {
      try {
        const summary = JSON.parse(line.substring(8)) as SessionSummary;
        this.metrics.parsedEvents++;
        this.emit('summary', summary);
      } catch (e) {
        this.metrics.parseErrors++;
        this.emit('error', { message: `Summary parse error: ${e}`, context: line.substring(0, 80) });
      }
      return;
    }

    // Single-line data
    if (line.startsWith('DATA|')) {
      try {
        const event = JSON.parse(line.substring(5)) as EchaEvent;
        this.metrics.parsedEvents++;
        this.trackMissingFields(event);
        this.emit('event', event);
      } catch (e) {
        this.metrics.parseErrors++;
        this.emit('error', { message: `Data parse error: ${e}`, context: line.substring(0, 80) });
      }
      return;
    }

    // Chunked data — format v2: CHUNK|seqId|index|total|data
    //                  legacy v1: CHUNK|index|total|data
    if (line.startsWith('CHUNK|')) {
      const parts = line.split('|');
      if (parts.length >= 5) {
        // v2 format with sequence ID
        const seqId = parseInt(parts[1], 10);
        const index = parseInt(parts[2], 10);
        const total = parseInt(parts[3], 10);
        const data = parts.slice(4).join('|');

        if (!this.chunkBuffers.has(seqId)) {
          this.chunkBuffers.set(seqId, { buffer: new Array(total).fill(''), total, ts: Date.now() });
        }
        const entry = this.chunkBuffers.get(seqId)!;
        entry.buffer[index] = data;
      } else if (parts.length >= 4) {
        // legacy v1 format (backward compat)
        const index = parseInt(parts[1], 10);
        const total = parseInt(parts[2], 10);
        if (this.expectedChunks !== total) {
          this.chunkBuffer = new Array(total).fill('');
          this.expectedChunks = total;
        }
        this.chunkBuffer[index] = parts.slice(3).join('|');
      }
      return;
    }

    if (line.startsWith('END|')) {
      const endParts = line.split('|');
      // v2: END|seqId|timestamp — v1: END|timestamp
      const isV2 = endParts.length >= 3;
      const seqId = isV2 ? parseInt(endParts[1], 10) : -1;

      let buffer: string[];
      if (isV2 && this.chunkBuffers.has(seqId)) {
        buffer = this.chunkBuffers.get(seqId)!.buffer;
        this.chunkBuffers.delete(seqId);
      } else {
        buffer = this.chunkBuffer;
        this.chunkBuffer = [];
        this.expectedChunks = 0;
      }

      if (buffer.length > 0 && buffer.every(c => c !== '')) {
        try {
          const event = JSON.parse(buffer.join('')) as EchaEvent;
          this.metrics.parsedEvents++;
          this.metrics.chunkSuccess++;
          this.trackMissingFields(event);
          this.emit('event', event);
        } catch (e) {
          this.metrics.parseErrors++;
          this.metrics.chunkFails++;
          this.emit('error', { message: `Chunk parse error: ${e}`, context: 'chunk-reassembly' });
        }
      } else if (buffer.length > 0) {
        this.metrics.chunkFails++;
        const missing = buffer.filter(c => c === '').length;
        this.emit('error', { message: `Chunk incomplete: ${missing}/${buffer.length} missing`, context: 'chunk-incomplete' });
      }

      // Cleanup stale buffers (>30s old)
      const now = Date.now();
      for (const [id, entry] of this.chunkBuffers) {
        if (now - entry.ts > 30000) this.chunkBuffers.delete(id);
      }
    }
  }

  private handleBridgeData(jsonStr: string): void {
    try {
      const tracker = JSON.parse(jsonStr) as TrackerEvent;
      this.metrics.parsedEvents++;

      if (tracker.type === 'session_summary') {
        const summary: SessionSummary = {
          type: 'session_summary',
          timestamp: tracker.timestamp || Date.now(),
          totalPostsViewed: tracker.totalPosts || 0,
          posts: (tracker.posts || []).map(p => ({
            postId: p.postId,
            dwellTimeMs: p.dwellTimeMs,
            dwellTimeSec: Math.round(p.dwellTimeMs / 100) / 10,
            metadata: p.data ? {
              postId: p.postId,
              username: (p.data.username as string) || '',
              caption: (p.data.caption as string) || '',
              imageDescription: ((p.data.imageAlts as string[]) || []).join(' | '),
              likeCount: (p.data.likeCount as string) || '',
              date: (p.data.date as string) || '',
              mediaType: (p.data.mediaType as string) || 'photo',
              isSponsored: (p.data.isSponsored as boolean) || false,
              isSuggested: (p.data.isSuggested as boolean) || false,
              videoUrl: (p.data.videoUrl as string) || '',
            } : undefined,
          })),
        };
        this.emit('summary', summary);
        return;
      }

      if ((tracker.type === 'new_post' || tracker.type === 'post_update') && tracker.post) {
        const p = tracker.post;
        const d = p.data;
        // Convert tracker.js post to EchaEvent format
        const event: EchaEvent = {
          timestamp: p.lastSeen || Date.now(),
          eventType: tracker.type === 'new_post' ? 'CONTENT_CHANGED' : 'STATE_CHANGED',
          screenType: 'feed',
          nodeCount: 0,
          focusedPostId: p.postId,
          focusedPost: {
            postId: p.postId,
            username: d.username || '',
            caption: d.fullCaption || d.caption || '',
            imageDescription: (d.imageAlts || []).join(' | '),
            likeCount: d.likeCount || '',
            date: d.date || '',
            mediaType: d.mediaType || 'photo',
            carouselCount: d.imageUrls?.length || 0,
            isSponsored: d.isSponsored || false,
            isSuggested: d.isSuggested || false,
          },
          visiblePosts: [],
          dwellTimes: { [p.postId]: p.dwellTimeMs },
          nodes: [],
          imageDescriptions: d.imageAlts || [],
        };
        this.emit('event', event);

        // Also emit the raw tracker event for the dashboard to use extra fields (imageUrls, etc.)
        this.emit('tracker', tracker);
        return;
      }

      if (tracker.type === 'log' && tracker.message) {
        // tracker.js debug logs — pass through
        this.emit('raw', `[tracker] ${tracker.message}`);
      }
    } catch (e) {
      this.metrics.parseErrors++;
      this.emit('error', { message: `Bridge parse error: ${e}`, context: jsonStr.substring(0, 80) });
    }
  }

  private handleMLKit(line: string): void {
    const separator = line.indexOf('|');
    if (separator === -1) return;
    try {
      const data = JSON.parse(line.substring(separator + 1)) as MLKitResult;
      this.metrics.mlkitResults++;
      this.emit('mlkit', data);
    } catch (e) {
      this.metrics.parseErrors++;
      this.emit('error', { message: `MLKit parse error: ${e}`, context: line.substring(0, 80) });
    }
  }

  private trackMissingFields(event: EchaEvent): void {
    if (!event.focusedPost) this.incMissing('focusedPost');
    if (!event.visiblePosts?.length) this.incMissing('visiblePosts');
    if (!event.nodes?.length) this.incMissing('nodes');
    if (!event.imageDescriptions?.length) this.incMissing('imageDescriptions');
    if (!event.dwellTimes || Object.keys(event.dwellTimes).length === 0) this.incMissing('dwellTimes');
    if (!event.screenType) this.incMissing('screenType');
  }

  private incMissing(field: string): void {
    this.metrics.missingFields[field] = (this.metrics.missingFields[field] || 0) + 1;
  }
}
