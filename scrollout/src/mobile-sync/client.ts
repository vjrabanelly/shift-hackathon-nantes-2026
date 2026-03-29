/**
 * MobileSyncClient — fetch data from mobile HTTP API.
 * Connects via ADB port-forward or direct IP.
 */

export interface MobileSession {
  id: string;
  capturedAt: number;
  durationSec: number;
  totalPosts: number;
  captureMode: string;
  postCount: number;
}

export interface MobilePost {
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
  enrichment?: {
    politicalScore: number;
    polarizationScore: number;
    confidenceScore: number;
    mainTopics: string;
    axisEconomic: number;
    axisSocietal: number;
    axisAuthority: number;
    axisSystem: number;
    dominantAxis: string;
    mediaCategory: string;
    mediaQuality: string;
  };
}

export interface MobileStats {
  totalSessions: number;
  totalPosts: number;
  totalEnriched: number;
  attention: Record<string, number>;
  political: Record<string, number>;
  axes?: { economic: number; societal: number; authority: number; system: number };
  avgPolarization?: number;
  avgConfidence?: number;
  topCategories: Array<{ category: string; count: number }>;
  topUsers: Array<{ username: string; count: number; totalDwellMs: number }>;
}

export class MobileSyncClient {
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:8765') {
    this.baseUrl = baseUrl;
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getSessions(): Promise<MobileSession[]> {
    const res = await fetch(`${this.baseUrl}/api/sessions`);
    return res.json();
  }

  async getPosts(sessionId: string, offset = 0, limit = 50): Promise<MobilePost[]> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/posts?offset=${offset}&limit=${limit}`);
    return res.json();
  }

  async getAllPosts(offset = 0, limit = 100): Promise<MobilePost[]> {
    const res = await fetch(`${this.baseUrl}/api/posts?offset=${offset}&limit=${limit}`);
    return res.json();
  }

  async getStats(): Promise<MobileStats> {
    const res = await fetch(`${this.baseUrl}/api/stats`);
    return res.json();
  }

  async exportSession(sessionId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/export/${sessionId}`);
    return res.json();
  }
}

/**
 * Try to establish ADB port-forward and connect.
 */
export async function connectToMobile(port = 8765): Promise<MobileSyncClient | null> {
  const client = new MobileSyncClient(`http://localhost:${port}`);

  // Try direct connection first (port-forward may already be active)
  if (await client.health()) {
    console.log(`[mobile-sync] Connected to mobile on port ${port}`);
    return client;
  }

  // Try setting up ADB port-forward
  try {
    const { execSync } = await import('child_process');
    const { findAdbPath } = await import('../adb-path');
    const adb = findAdbPath();
    execSync(`"${adb}" forward tcp:${port} tcp:${port}`, { stdio: 'ignore' });
    console.log(`[mobile-sync] ADB port-forward tcp:${port} → tcp:${port}`);

    // Retry connection
    if (await client.health()) {
      console.log(`[mobile-sync] Connected to mobile via ADB forward`);
      return client;
    }
  } catch (e) {
    console.warn(`[mobile-sync] ADB forward failed:`, e instanceof Error ? e.message : e);
  }

  console.warn(`[mobile-sync] Could not connect to mobile on port ${port}`);
  return null;
}
