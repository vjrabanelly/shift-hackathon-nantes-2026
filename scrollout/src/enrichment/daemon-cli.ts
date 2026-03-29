/**
 * CLI pour lancer le daemon d'enrichissement automatique.
 *
 * Usage:
 *   npx tsx src/enrichment/daemon-cli.ts                    # Ollama, check toutes les 60s
 *   npx tsx src/enrichment/daemon-cli.ts --openai           # OpenAI
 *   npx tsx src/enrichment/daemon-cli.ts --interval 120     # Check toutes les 2 min
 *   npx tsx src/enrichment/daemon-cli.ts --batch 50         # Batch de 50
 *   npx tsx src/enrichment/daemon-cli.ts --threshold 5      # Déclenche à 5+ posts en attente
 *   npx tsx src/enrichment/daemon-cli.ts --rules-only       # Rules seulement (pas de LLM)
 */
import 'dotenv/config';
import { startDaemon, stopDaemon } from './daemon';
import { createOllamaProvider } from './llm/ollama';
import { createOpenAIProvider } from './llm/openai';

async function main() {
  const args = process.argv.slice(2);

  const useOpenAI = args.includes('--openai');
  const rulesOnly = args.includes('--rules-only');

  const intervalIdx = args.indexOf('--interval');
  const intervalSec = intervalIdx !== -1 ? parseInt(args[intervalIdx + 1], 10) : 60;

  const batchIdx = args.indexOf('--batch');
  const batchSize = batchIdx !== -1 ? parseInt(args[batchIdx + 1], 10) : 20;

  const thresholdIdx = args.indexOf('--threshold');
  const threshold = thresholdIdx !== -1 ? parseInt(args[thresholdIdx + 1], 10) : 3;

  // Provider LLM
  let llmProvider;
  if (rulesOnly) {
    llmProvider = createOllamaProvider();
    console.log('[enrich:daemon] Mode rules-only (pas de LLM)');
  } else if (useOpenAI) {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[enrich:daemon] OPENAI_API_KEY non défini dans .env');
      process.exit(1);
    }
    llmProvider = createOpenAIProvider();
    console.log('[enrich:daemon] Provider: OpenAI (gpt-4o-mini)');
  } else {
    llmProvider = createOllamaProvider();
    console.log('[enrich:daemon] Provider: Ollama (llama3.1:8b)');
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[enrich:daemon] Arrêt demandé...');
    await stopDaemon();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await startDaemon({
    intervalMs: intervalSec * 1000,
    batchSize,
    threshold,
    enrichmentOptions: {
      llmProvider,
      rulesOnly,
      delayMs: useOpenAI ? 200 : 100,
    },
  });
}

main().catch(err => {
  console.error('[enrich:daemon] Fatal:', err);
  process.exit(1);
});
