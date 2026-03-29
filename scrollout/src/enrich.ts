/**
 * ECHA Enrichment CLI — Enrichit les posts non enrichis dans la base.
 *
 * Usage:
 *   npx tsx src/enrich.ts                    # Ollama (défaut), batch 20
 *   npx tsx src/enrich.ts --rules-only       # Rules seulement (pas de LLM)
 *   npx tsx src/enrich.ts --openai           # Utilise OpenAI
 *   npx tsx src/enrich.ts --batch 50         # Batch de 50
 *   npx tsx src/enrich.ts --dry-run          # Ne persiste pas
 *   npx tsx src/enrich.ts --post-id "xxx"    # Enrichit un post spécifique
 *   npx tsx src/enrich.ts --with-audio       # Active la transcription audio vidéos (Whisper)
 *   npx tsx src/enrich.ts --whisper-api      # Utilise Whisper API au lieu de Whisper local
 *   npx tsx src/enrich.ts --vision           # Active GPT-4o vision pour posts à signal faible
 *   npx tsx src/enrich.ts --vision-high      # Vision en détail high (plus précis, plus cher)
 */
import 'dotenv/config';
import { enrichBatch } from './enrichment/pipeline';
import { createOllamaProvider } from './enrichment/llm/ollama';
import { createOpenAIProvider } from './enrichment/llm/openai';
import { createWhisperLocalProvider, createWhisperAPIProvider, TranscriptionProvider } from './media/transcribe';

async function main() {
  const args = process.argv.slice(2);

  const useOpenAI = args.includes('--openai');
  const rulesOnly = args.includes('--rules-only');
  const dryRun = args.includes('--dry-run');
  const withAudio = args.includes('--with-audio');
  const useWhisperAPI = args.includes('--whisper-api');
  const enableVision = args.includes('--vision') || args.includes('--vision-high');
  const visionDetail = args.includes('--vision-high') ? 'high' as const : 'low' as const;

  const batchIdx = args.indexOf('--batch');
  const batchSize = batchIdx !== -1 ? parseInt(args[batchIdx + 1], 10) : 20;

  const postIdIdx = args.indexOf('--post-id');
  const postIds = postIdIdx !== -1 ? [args[postIdIdx + 1]] : undefined;

  // Choisir le provider
  let llmProvider;
  if (rulesOnly) {
    // Dummy provider (ne sera pas appelé)
    llmProvider = createOllamaProvider();
    console.log('[enrich] Mode rules-only (pas de LLM)');
  } else if (useOpenAI) {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[enrich] OPENAI_API_KEY non défini dans .env');
      process.exit(1);
    }
    llmProvider = createOpenAIProvider();
    console.log('[enrich] Provider: OpenAI (gpt-4o-mini)');
  } else {
    llmProvider = createOllamaProvider();
    console.log('[enrich] Provider: Ollama (llama3.1:8b)');
  }

  // Audio transcription provider
  let transcriptionProvider: TranscriptionProvider | undefined;
  if (withAudio) {
    if (useWhisperAPI) {
      if (!process.env.OPENAI_API_KEY) {
        console.error('[enrich] OPENAI_API_KEY requis pour --whisper-api');
        process.exit(1);
      }
      transcriptionProvider = createWhisperAPIProvider();
      console.log('[enrich] Audio: Whisper API (OpenAI)');
    } else {
      transcriptionProvider = createWhisperLocalProvider();
      console.log('[enrich] Audio: Whisper local');
    }
  }

  if (enableVision && !useOpenAI) {
    console.log('[enrich] ⚠️ --vision nécessite --openai (Ollama ne supporte pas la vision)');
  }
  console.log(`[enrich] Batch: ${batchSize}, dryRun: ${dryRun}, audio: ${withAudio}, vision: ${enableVision}${enableVision ? ` (${visionDetail})` : ''}`);

  const result = await enrichBatch({
    llmProvider,
    batchSize,
    rulesOnly,
    dryRun,
    postIds,
    delayMs: useOpenAI ? 200 : 100,
    transcriptionProvider,
    enableVision,
    visionDetail,
  });

  console.log(`[enrich] Résultat final:`, result);
  process.exit(0);
}

main().catch(err => {
  console.error('[enrich] Fatal:', err);
  process.exit(1);
});
