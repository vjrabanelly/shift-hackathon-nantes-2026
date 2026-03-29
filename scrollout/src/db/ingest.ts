/**
 * ECHA Ingest — Importe un fichier _analysis.json dans SQLite via Prisma.
 */

import { readFileSync } from 'fs';
import path from 'path';
import prisma from './client';

interface AnalysisFile {
  session: {
    capturedAt: string;
    durationSec: number;
    totalEvents: number;
    totalViewTimeSec: number;
  };
  posts: AnalysisPost[];
}

interface AnalysisPost {
  username: string;
  displayName: string;
  caption: string;
  hashtags: string[];
  imageDescription: string;
  mediaType: string;
  carouselCount: number;
  likeCount: string;
  likeNum: number;
  commentCount: string;
  commentNum: number;
  shareCount: string;
  saveCount: string;
  date: string;
  isSponsored: boolean;
  isSuggested: boolean;
  audioTrack: string;
  mentionedAccounts: string[];
  allTextContent: string;
  ocrText: string;
  mlkitLabels: Array<{ text: string; confidence: number }>;
  imageUrls?: string[];
  videoUrl?: string;
  subtitles: string;
  firstSeenAt: number;
  lastSeenAt: number;
  dwellTimeMs: number;
  dwellTimeSec: number;
  seenCount: number;
  contentCategory: string;
  attentionLevel: string;
}

function hashPost(sessionId: string, post: AnalysisPost, index: number): string {
  // Deterministic ID: session + username + index (un même user peut avoir plusieurs posts)
  return `${sessionId}:${post.username}:${index}`;
}

export async function ingestAnalysis(analysisPath: string): Promise<{ sessionId: string; postCount: number }> {
  const raw = readFileSync(analysisPath, 'utf-8');
  const data: AnalysisFile = JSON.parse(raw);

  // Derive session ID from filename: session_1774654173190_analysis.json → 1774654173190
  const basename = path.basename(analysisPath);
  const match = basename.match(/session_(\d+)/);
  if (!match) throw new Error(`Cannot parse session ID from filename: ${basename}`);
  const sessionId = match[1];

  // Derive source session file path
  const sourceFile = analysisPath.replace('_analysis.json', '.json');

  // Check if session already ingested
  const existing = await prisma.session.findUnique({ where: { id: sessionId } });
  if (existing) {
    console.log(`[ingest] Session ${sessionId} already in DB, skipping.`);
    return { sessionId, postCount: 0 };
  }

  // Create session
  await prisma.session.create({
    data: {
      id: sessionId,
      capturedAt: new Date(data.session.capturedAt),
      durationSec: data.session.durationSec,
      totalEvents: data.session.totalEvents,
      totalPosts: data.posts.length,
      captureMode: 'accessibility',
      sourceFile: path.resolve(sourceFile),
    },
  });

  // Create posts
  for (let i = 0; i < data.posts.length; i++) {
    const p = data.posts[i];
    const postId = hashPost(sessionId, p, i);

    await prisma.post.create({
      data: {
        id: postId,
        sessionId,
        username: p.username,
        displayName: p.displayName || '',
        caption: p.caption || '',
        hashtags: JSON.stringify(p.hashtags || []),
        imageDesc: p.imageDescription || '',
        imageUrls: JSON.stringify(p.imageUrls || []),
        mediaType: p.mediaType || 'photo',
        likeCount: p.likeNum || 0,
        commentCount: p.commentNum || 0,
        shareCount: p.shareCount || '',
        saveCount: p.saveCount || '',
        dateLabel: p.date || '',
        isSponsored: p.isSponsored || false,
        isSuggested: p.isSuggested || false,
        audioTrack: p.audioTrack || '',
        mentioned: JSON.stringify(p.mentionedAccounts || []),
        allText: p.allTextContent || '',
        ocrText: p.ocrText || '',
        mlkitLabels: JSON.stringify(p.mlkitLabels || []),
        videoUrl: p.videoUrl || '',
        subtitles: p.subtitles || '',
        dwellTimeMs: p.dwellTimeMs || 0,
        attentionLevel: p.attentionLevel || 'skipped',
        category: p.contentCategory || 'non classifié',
        firstSeenAt: p.firstSeenAt || 0,
        lastSeenAt: p.lastSeenAt || 0,
        seenCount: p.seenCount || 1,
      },
    });
  }

  console.log(`[ingest] Session ${sessionId}: ${data.posts.length} posts ingested.`);
  return { sessionId, postCount: data.posts.length };
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
