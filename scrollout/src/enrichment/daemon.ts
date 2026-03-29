/**
 * Enrichment Daemon — tourne en continu, enrichit automatiquement les nouveaux posts.
 *
 * Vérifie périodiquement les posts non enrichis et lance le pipeline LLM en batch.
 */
import prisma from '../db/client';
import { enrichBatch, type EnrichmentOptions } from './pipeline';

export interface DaemonOptions {
  /** Intervalle de vérification en ms (défaut: 60000 = 1 min) */
  intervalMs?: number;
  /** Nombre de posts par batch (défaut: 20) */
  batchSize?: number;
  /** Seuil minimum de posts non enrichis pour déclencher un batch (défaut: 3) */
  threshold?: number;
  /** Options d'enrichissement (llmProvider, rulesOnly, etc.) */
  enrichmentOptions: Omit<EnrichmentOptions, 'batchSize' | 'postIds' | 'dryRun'>;
  /** Callback optionnel sur changement de statut */
  onStatusChange?: (status: DaemonStatus) => void;
}

export interface DaemonStatus {
  running: boolean;
  lastCheckAt: string | null;
  lastEnrichAt: string | null;
  pendingPosts: number;
  totalBatches: number;
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  totalSkipped: number;
  consecutiveErrors: number;
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let processing = false;

const stats = {
  running: false,
  lastCheckAt: null as string | null,
  lastEnrichAt: null as string | null,
  pendingPosts: 0,
  totalBatches: 0,
  totalProcessed: 0,
  totalSucceeded: 0,
  totalFailed: 0,
  totalSkipped: 0,
  consecutiveErrors: 0,
};

function log(msg: string) {
  console.log(`[enrich:daemon] ${msg}`);
}

function getStatus(): DaemonStatus {
  return { ...stats };
}

async function countPending(): Promise<number> {
  return prisma.post.count({ where: { enrichment: null } });
}

async function tick(options: DaemonOptions) {
  if (processing) return;
  processing = true;

  try {
    stats.lastCheckAt = new Date().toISOString();
    const pending = await countPending();
    stats.pendingPosts = pending;

    const threshold = options.threshold ?? 3;
    const batchSize = options.batchSize ?? 20;

    if (pending < threshold) {
      log(`${pending} post(s) en attente (seuil: ${threshold}) — skip`);
      options.onStatusChange?.(getStatus());
      return;
    }

    log(`${pending} posts en attente — lancement batch de ${Math.min(pending, batchSize)}`);

    const result = await enrichBatch({
      ...options.enrichmentOptions,
      batchSize,
      dryRun: false,
    });

    stats.totalBatches++;
    stats.totalProcessed += result.processed;
    stats.totalSucceeded += result.succeeded;
    stats.totalFailed += result.failed;
    stats.totalSkipped += result.skipped;
    stats.lastEnrichAt = new Date().toISOString();
    stats.consecutiveErrors = 0;

    log(`Batch terminé: ${result.succeeded}/${result.processed} enrichis, ${result.failed} erreurs, ${result.skipped} skippés`);

    // Quality metrics after batch
    try {
      const totalEnriched = await prisma.postEnriched.count();
      const emptyTopics = await prisma.postEnriched.count({ where: { OR: [{ mainTopics: '[]' }, { mainTopics: '' }] } });
      const reviewFlags = await prisma.postEnriched.count({ where: { reviewFlag: true } });
      const avgConf = await prisma.postEnriched.aggregate({ _avg: { confidenceScore: true } });
      const topicsOk = totalEnriched > 0 ? Math.round((totalEnriched - emptyTopics) / totalEnriched * 100) : 0;
      log(`Quality: ${topicsOk}% topics OK, avg conf ${avgConf._avg.confidenceScore?.toFixed(2) ?? '?'}, ${reviewFlags} review flags, ${emptyTopics} empty topics`);
    } catch { /* non-critical */ }

    options.onStatusChange?.(getStatus());
  } catch (err) {
    stats.consecutiveErrors++;
    const msg = err instanceof Error ? err.message : String(err);
    log(`Erreur tick #${stats.consecutiveErrors}: ${msg}`);

    // Backoff: si trop d'erreurs consécutives, on log un warning
    if (stats.consecutiveErrors >= 5) {
      log(`${stats.consecutiveErrors} erreurs consécutives — vérifier le provider LLM`);
    }
    options.onStatusChange?.(getStatus());
  } finally {
    processing = false;
  }
}

export async function startDaemon(options: DaemonOptions): Promise<void> {
  if (stats.running) {
    log('Daemon déjà en cours');
    return;
  }

  const intervalMs = options.intervalMs ?? 60_000;
  const threshold = options.threshold ?? 3;
  const batchSize = options.batchSize ?? 20;

  stats.running = true;
  log(`Démarré — intervalle: ${intervalMs / 1000}s, batch: ${batchSize}, seuil: ${threshold}`);
  options.onStatusChange?.(getStatus());

  // Premier tick immédiat
  await tick(options);

  // Puis périodique
  intervalHandle = setInterval(() => {
    tick(options).catch(err => {
      log(`Tick crash: ${err instanceof Error ? err.message : err}`);
    });
  }, intervalMs);
}

export async function stopDaemon(): Promise<void> {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  // Attendre la fin du traitement en cours
  if (processing) {
    log('Attente fin du batch en cours...');
    await new Promise<void>(resolve => {
      const check = setInterval(() => {
        if (!processing) {
          clearInterval(check);
          resolve();
        }
      }, 500);
    });
  }

  stats.running = false;
  log(`Arrêté — total: ${stats.totalSucceeded} enrichis en ${stats.totalBatches} batches`);
}

export { getStatus as getDaemonStatus };
