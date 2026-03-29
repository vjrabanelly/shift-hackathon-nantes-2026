/**
 * Backfill — Peuple le graphe de connaissances à partir des PostEnriched existants.
 *
 * Usage: npx tsx scripts/backfill-knowledge-graph.ts [--dry] [--batch 100]
 */
import prisma from '../src/db/client';
import { graphIngest } from '../src/enrichment/graph-ingest';
import type { MergedEnrichment } from '../src/enrichment/graph-ingest';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry');
  const batchIdx = args.indexOf('--batch');
  const batchSize = batchIdx !== -1 ? parseInt(args[batchIdx + 1], 10) || 100 : 100;

  // Check how many already have observations
  const existingObsPostIds = await prisma.observation.findMany({
    select: { postId: true },
    distinct: ['postId'],
  });
  const alreadyIngested = new Set(existingObsPostIds.map(o => o.postId));

  // Load all PostEnriched
  const enriched = await prisma.postEnriched.findMany();
  const toProcess = enriched.filter(e => !alreadyIngested.has(e.postId));

  console.log(`[backfill] ${enriched.length} PostEnriched total, ${alreadyIngested.size} already in graph, ${toProcess.length} to backfill`);

  if (dryRun) {
    console.log('[backfill] Dry run — no changes');
    return;
  }

  let processed = 0;
  let totalObs = 0;
  let totalEntities = 0;

  for (let i = 0; i < toProcess.length; i += batchSize) {
    const batch = toProcess.slice(i, i + batchSize);

    for (const pe of batch) {
      try {
        const merged: MergedEnrichment = {
          normalizedText: pe.normalizedText,
          semanticSummary: pe.semanticSummary,
          mainTopics: pe.mainTopics,
          secondaryTopics: pe.secondaryTopics,
          subjects: pe.subjects,
          preciseSubjects: pe.preciseSubjects,
          persons: pe.persons,
          organizations: pe.organizations,
          institutions: pe.institutions,
          countries: pe.countries,
          politicalActors: pe.politicalActors,
          narrativeFrame: pe.narrativeFrame,
          primaryEmotion: pe.primaryEmotion,
          tone: pe.tone,
          audienceTarget: pe.audienceTarget,
          confidenceScore: pe.confidenceScore,
          provider: pe.provider,
        };

        const result = await graphIngest(pe.postId, merged);
        totalObs += result.observationCount;
        totalEntities += result.entitiesCreated;
        processed++;
      } catch (err) {
        console.error(`[backfill] Error for ${pe.postId}:`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`[backfill] ${processed}/${toProcess.length} — ${totalObs} observations, ${totalEntities} entities created`);
  }

  // Final stats
  const entityCount = await prisma.knowledgeEntity.count();
  const obsCount = await prisma.observation.count();
  console.log(`\n[backfill] Done. Graph: ${entityCount} entities, ${obsCount} observations total.`);
}

main().catch(console.error);
