/**
 * Test script: verify mobile HTTP API is reachable via ADB port-forward.
 * Usage: npx tsx scripts/test-mobile-sync.ts
 */
import { connectToMobile } from '../src/mobile-sync/client';

async function main() {
  console.log('[test] Connecting to mobile...');
  const client = await connectToMobile();

  if (!client) {
    console.error('[test] FAIL: cannot connect to mobile');
    process.exit(1);
  }

  console.log('[test] Connected!');

  // Health
  const healthy = await client.health();
  console.log('[test] Health:', healthy ? 'OK' : 'FAIL');

  // Stats
  const stats = await client.getStats();
  console.log('[test] Stats:', JSON.stringify(stats, null, 2));

  // Sessions
  const sessions = await client.getSessions();
  console.log(`[test] Sessions: ${sessions.length}`);

  if (sessions.length > 0) {
    const latest = sessions[0]!;
    console.log(`[test] Latest session: ${latest.id} — ${latest.postCount} posts, ${Math.round(latest.durationSec)}s`);

    // Posts
    const posts = await client.getPosts(latest.id, 0, 5);
    console.log(`[test] Posts in latest session: ${posts.length}`);
    for (const p of posts) {
      console.log(`  @${p.username} [${p.attentionLevel}] ${p.dwellTimeMs}ms — ${p.allText?.substring(0, 60) || '(no text)'}`);
    }
  }

  console.log('[test] All checks passed!');
  process.exit(0);
}

main().catch(e => {
  console.error('[test] Error:', e);
  process.exit(1);
});
