/**
 * 014-7 : Script de ré-enrichissement ciblé.
 *
 * Usage:
 *   npx tsx scripts/re-enrich.ts --empty-topics        # Posts avec mainTopics=[]
 *   npx tsx scripts/re-enrich.ts --rules-only-upgrade   # Posts rules-only → LLM
 *   npx tsx scripts/re-enrich.ts --low-confidence       # Posts avec confidence < 0.5
 *   npx tsx scripts/re-enrich.ts --all                  # Tout ré-enrichir
 *   npx tsx scripts/re-enrich.ts --dry-run              # Preview sans écriture
 *   npx tsx scripts/re-enrich.ts --openai               # Utilise OpenAI au lieu d'Ollama
 */
import 'dotenv/config';
import prisma from '../src/db/client';
import { enrichBatch } from '../src/enrichment/pipeline';
import { createOllamaProvider } from '../src/enrichment/llm/ollama';
import { createOpenAIProvider } from '../src/enrichment/llm/openai';

async function main() {
  const args = process.argv.slice(2);

  const emptyTopics = args.includes('--empty-topics');
  const rulesOnlyUpgrade = args.includes('--rules-only-upgrade');
  const lowConfidence = args.includes('--low-confidence');
  const all = args.includes('--all');
  const dryRun = args.includes('--dry-run');
  const useOpenAI = args.includes('--openai');

  if (!emptyTopics && !rulesOnlyUpgrade && !lowConfidence && !all) {
    console.log('Usage: npx tsx scripts/re-enrich.ts [--empty-topics] [--rules-only-upgrade] [--low-confidence] [--all] [--dry-run] [--openai]');
    process.exit(1);
  }

  // Find posts to re-enrich
  let where: any = {};
  const conditions: any[] = [];

  if (emptyTopics) {
    conditions.push({ mainTopics: '[]' });
    conditions.push({ mainTopics: '' });
  }
  if (rulesOnlyUpgrade) {
    conditions.push({ provider: 'rules' });
  }
  if (lowConfidence) {
    conditions.push({ confidenceScore: { lt: 0.5 } });
  }

  if (all) {
    where = {}; // all enriched posts
  } else if (conditions.length > 0) {
    where = { OR: conditions };
  }

  const toReenrich = await prisma.postEnriched.findMany({
    where,
    select: { id: true, postId: true, mainTopics: true, provider: true, confidenceScore: true, post: { select: { username: true, mediaType: true } } },
    orderBy: { confidenceScore: 'asc' },
  });

  console.log(`\n[re-enrich] ${toReenrich.length} posts à ré-enrichir`);
  if (toReenrich.length === 0) {
    console.log('[re-enrich] Rien à faire.');
    process.exit(0);
  }

  // Preview
  console.log('\n── POSTS CIBLÉS ──');
  for (const p of toReenrich.slice(0, 20)) {
    const topics = (() => { try { return JSON.parse(p.mainTopics); } catch { return []; } })();
    console.log(`  @${p.post.username || '?'} [${p.post.mediaType}] provider=${p.provider} conf=${p.confidenceScore} topics=[${topics.join(',')}]`);
  }
  if (toReenrich.length > 20) console.log(`  ... et ${toReenrich.length - 20} autres`);

  if (dryRun) {
    console.log('\n[re-enrich] Dry run — aucune modification.');
    process.exit(0);
  }

  // Setup LLM provider
  let llmProvider;
  if (useOpenAI) {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[re-enrich] OPENAI_API_KEY non défini dans .env');
      process.exit(1);
    }
    llmProvider = createOpenAIProvider();
    console.log('\n[re-enrich] Provider: OpenAI');
  } else {
    llmProvider = createOllamaProvider();
    console.log('\n[re-enrich] Provider: Ollama');
  }

  // Delete existing enrichments and re-enrich
  const postIds = toReenrich.map(p => p.postId);
  console.log(`[re-enrich] Suppression de ${postIds.length} enrichissements existants...`);

  const deleted = await prisma.postEnriched.deleteMany({
    where: { postId: { in: postIds } },
  });
  console.log(`[re-enrich] ${deleted.count} enrichissements supprimés.`);

  // Re-enrich in batches
  const batchSize = 20;
  console.log(`[re-enrich] Ré-enrichissement par batches de ${batchSize}...`);

  const result = await enrichBatch({
    llmProvider,
    batchSize: postIds.length, // process all at once since we've already filtered
    delayMs: 500,
    rulesOnly: false,
    dryRun: false,
    postIds,
  });

  console.log(`\n[re-enrich] Résultat: ${result.succeeded}/${result.processed} réussis, ${result.failed} erreurs, ${result.skipped} skippés`);

  // Verify improvement
  const afterEmpty = await prisma.postEnriched.count({
    where: { postId: { in: postIds }, OR: [{ mainTopics: '[]' }, { mainTopics: '' }] },
  });
  const afterTotal = await prisma.postEnriched.count({
    where: { postId: { in: postIds } },
  });

  console.log(`\n── VÉRIFICATION ──`);
  console.log(`  Avant: ${toReenrich.length} posts ciblés`);
  console.log(`  Après: ${afterTotal} enrichis, dont ${afterEmpty} encore sans topics`);
  console.log(`  Amélioration: ${toReenrich.length - afterEmpty} posts corrigés`);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
