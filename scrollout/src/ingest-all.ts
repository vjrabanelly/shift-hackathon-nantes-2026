/**
 * ECHA Batch Ingest — Ingère toutes les sessions analysées dans SQLite.
 * Usage: npx tsx src/ingest-all.ts
 */

import { readdirSync } from 'fs';
import path from 'path';
import { ingestAnalysis, disconnect } from './db/ingest';

async function main(): Promise<void> {
  const dataDir = path.join(__dirname, '..', 'data');
  const analysisFiles = readdirSync(dataDir)
    .filter(f => f.startsWith('session_') && f.endsWith('_analysis.json'))
    .sort();

  if (analysisFiles.length === 0) {
    console.log('[ingest-all] Aucun fichier _analysis.json trouvé dans data/');
    return;
  }

  console.log(`[ingest-all] ${analysisFiles.length} fichier(s) à ingérer.\n`);

  let totalPosts = 0;
  let ingested = 0;

  for (const file of analysisFiles) {
    const fullPath = path.join(dataDir, file);
    const result = await ingestAnalysis(fullPath);
    totalPosts += result.postCount;
    if (result.postCount > 0) ingested++;
  }

  console.log(`\n[ingest-all] Done. ${ingested} session(s), ${totalPosts} posts au total.`);
  await disconnect();
}

main().catch(err => {
  console.error('[ingest-all] Error:', err);
  process.exit(1);
});
