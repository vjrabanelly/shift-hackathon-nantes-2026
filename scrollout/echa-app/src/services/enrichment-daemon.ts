/**
 * Enrichment Daemon Mobile — tourne dans l'app Capacitor,
 * enrichit automatiquement les posts via rules + LLM (OpenAI API).
 *
 * Architecture:
 * 1. Vérifie périodiquement les posts non enrichis (via plugin Capacitor → SQLite)
 * 2. Applique les rules (enrichment.js réutilisé)
 * 3. Appelle l'API OpenAI pour enrichissement LLM
 * 4. Sauvegarde via plugin Capacitor → SQLite
 */

import {
  callOpenAI,
  callOpenAIBatch,
  buildEnrichmentPrompt,
  SYSTEM_PROMPT,
  type LLMConfig,
  type LLMMessage,
  type BatchPost,
} from './llm-mobile';
import { applyRulesShared, inferFallbackTopic, type RulesInput } from './rules-engine-shared';
import { getPreciseSubjectsForTheme, getPreciseSubjectById } from '@shared/dictionaries';
import { graphIngestMobile, type MobileEnrichment } from './graph-ingest-mobile';

// ── Types ────────────────────────────────────────────────────

interface UnenrichedPost {
  id: string;           // DB row id (sessionId:username:postId)
  postId: string;       // Instagram post id
  username: string;
  caption: string;
  fullCaption: string;
  hashtags: string;     // JSON array
  imageAlts: string;    // JSON array
  allText: string;
  ocrText: string;
  mlkitLabels: string;  // JSON array
  mediaType: string;
  isSponsored: boolean;
  isSuggested: boolean;
  imageUrls: string;    // JSON array of CDN URLs
  videoUrl: string;     // CDN URL for video/reel
}

interface LLMEnrichmentResult {
  semantic_summary: string;
  main_topics: string[];
  secondary_topics: string[];
  subjects: string[];
  precise_subjects: Array<{ id: string; position: string; confidence: number }>;
  persons: string[];
  organizations: string[];
  institutions: string[];
  countries: string[];
  tone: string;
  primary_emotion: string;
  emotion_intensity: number;
  political_explicitness_score: number;
  polarization_score: number;
  narrative_frame: string;
  call_to_action_type: string;
  media_hook: string;
  media_message: string;
  media_intent: string;
  confidence_score: number;
}

export interface DaemonConfig {
  /** Intervalle de vérification en secondes (défaut: 120) */
  intervalSec: number;
  /** Taille du batch (défaut: 10) */
  batchSize: number;
  /** Seuil minimum de posts pour déclencher un batch (défaut: 3) */
  threshold: number;
  /** Clé API OpenAI */
  apiKey: string;
  /** Modèle OpenAI (défaut: gpt-4o-mini) */
  model?: string;
  /** Mode rules-only (pas de LLM) */
  rulesOnly?: boolean;
  /** Active la transcription Whisper API pour vidéos sans texte */
  enableTranscription?: boolean;
  /** Active l'analyse vision pour posts visuels à faible signal */
  enableVision?: boolean;
}

export interface DaemonStatus {
  running: boolean;
  lastCheckAt: string | null;
  lastEnrichAt: string | null;
  pendingPosts: number;
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  totalSkipped: number;
  /** Current phase: idle, rules, llm, done */
  phase: 'idle' | 'rules' | 'llm' | 'done';
  /** Posts enriched by rules only this tick */
  rulesCount: number;
  /** Posts refined by LLM this tick */
  llmCount: number;
  /** Total posts to process this tick */
  tickTotal: number;
  /** Whether LLM (OpenAI) is enabled */
  llmEnabled: boolean;
}

// TODO: Pour la production, supprimer la clé hardcodée et forcer la saisie utilisateur.
// La clé est injectée ici pour la démo uniquement (app non distribuée).

// ── Plugin access ────────────────────────────────────────────

function getPlugin(): any {
  return (window as any).Capacitor?.Plugins?.InstaWebView;
}

// ── Rules engine (shared module — même code que le PC) ───────

function applyRulesFromShared(post: UnenrichedPost): ReturnType<typeof applyRulesShared> | null {
  try {
    const hashtags = safeParseArray(post.hashtags);
    return applyRulesShared({
      username: post.username,
      caption: post.caption,
      fullCaption: post.fullCaption,
      imageAlts: post.imageAlts,
      allText: post.allText,
      hashtags,
      ocrText: post.ocrText,
      mlkitLabelsText: safeParseArray(post.mlkitLabels).length > 0 ? post.mlkitLabels : undefined,
      isSponsored: post.isSponsored,
    });
  } catch (err) {
    log(`rules error: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

function safeParseArray(json: string): string[] {
  try { return JSON.parse(json || '[]'); } catch { return []; }
}

// ── Daemon state ─────────────────────────────────────────────

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let processing = false;
let config: DaemonConfig | null = null;
let listeners: Array<(status: DaemonStatus) => void> = [];

const stats: DaemonStatus = {
  running: false,
  lastCheckAt: null,
  lastEnrichAt: null,
  pendingPosts: 0,
  totalProcessed: 0,
  totalSucceeded: 0,
  totalFailed: 0,
  totalSkipped: 0,
  phase: 'idle',
  rulesCount: 0,
  llmCount: 0,
  tickTotal: 0,
  llmEnabled: false,
};

function log(msg: string) {
  console.log(`[enrich:daemon] ${msg}`);
}

function notify() {
  for (const fn of listeners) fn({ ...stats });
}

// ── Core logic ───────────────────────────────────────────────

async function countPending(): Promise<number> {
  const plugin = getPlugin();
  if (!plugin) return 0;
  const result = await plugin.countUnenrichedPosts();
  return result.count || 0;
}

async function fetchUnenriched(limit: number): Promise<UnenrichedPost[]> {
  const plugin = getPlugin();
  if (!plugin) return [];
  const result = await plugin.queryUnenrichedPosts({ limit });
  return JSON.parse(result.posts || '[]');
}

async function fetchRulesOnlyPosts(limit: number): Promise<UnenrichedPost[]> {
  const plugin = getPlugin();
  if (!plugin?.queryRulesOnlyPosts) return [];
  try {
    const result = await plugin.queryRulesOnlyPosts({ limit });
    return JSON.parse(result.posts || '[]');
  } catch {
    return [];
  }
}

async function saveEnrichment(dbPostId: string, enrichment: Record<string, any>): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) return;
  await plugin.saveEnrichmentFromApp({
    dbPostId,
    enrichment: JSON.stringify(enrichment),
  });
}

// ── Enrichment level selection ───────────────────────────────

type EnrichmentLevel = 'rules-only' | 'text-llm' | 'vision';

function selectEnrichmentLevel(
  rulesConfidence: number,
  post: UnenrichedPost,
  llmConfig: LLMConfig | null,
  hasExtraVideoText: boolean,
): EnrichmentLevel {
  if (!llmConfig) return 'rules-only';
  if (rulesConfidence >= 0.65) return 'rules-only';
  if (rulesConfidence >= 0.35 || hasExtraVideoText) return 'text-llm';

  // Low confidence — use vision if images available
  const images = safeParseArray(post.imageUrls);
  if (images.length > 0 && config?.enableVision) return 'vision';

  return 'text-llm';
}

/**
 * Tente d'enrichir le signal vidéo : OCR existant puis Whisper API si nécessaire.
 * Retourne le texte additionnel à injecter, ou '' si rien de plus.
 */
async function enrichVideoSignal(
  post: UnenrichedPost,
  normalizedText: string,
  llmConfig: LLMConfig | null,
): Promise<{ text: string; source: 'ocr' | 'whisper' | 'none' }> {
  // L'OCR est déjà intégré dans normalizedText via rules-engine-shared.
  // Vérifier si le texte normalisé contient assez de signal.
  const words = normalizedText.split(/\s+/).filter(w => w.length > 2);
  if (words.length >= 20) {
    return { text: '', source: 'ocr' }; // OCR/subtitles suffisent
  }

  // Pas assez de texte — tenter Whisper API si activé et videoUrl dispo
  if (!config?.enableTranscription || !llmConfig?.apiKey || !post.videoUrl) {
    return { text: '', source: 'none' };
  }

  try {
    const { callWhisperAPI, evaluateTranscriptionQuality } = await import('./llm-mobile');
    const transcription = await callWhisperAPI(post.videoUrl, llmConfig.apiKey);

    if (!transcription) {
      log(`whisper @${post.username} — pas de réponse`);
      return { text: '', source: 'none' };
    }

    const quality = evaluateTranscriptionQuality(transcription);
    if (!quality.acceptable) {
      log(`whisper @${post.username} — qualité insuffisante: ${quality.reason}`);
      return { text: '', source: 'none' };
    }

    log(`whisper @${post.username} — ${transcription.length} chars, qualité OK`);
    return { text: `[AUDIO_TRANSCRIPT] ${transcription}`, source: 'whisper' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`whisper error @${post.username}: ${msg}`);
    return { text: '', source: 'none' };
  }
}

// ── Build enrichment data from rules ────────────────────────

function buildRulesEnrichment(
  rulesResult: ReturnType<typeof applyRulesShared>,
  normalizedText: string,
  post: UnenrichedPost,
  reviewFlag = false,
  reviewReason = '',
): Record<string, any> {
  const rulesTopics = rulesResult.mainTopics?.length
    ? rulesResult.mainTopics
    : [inferFallbackTopic(post.username, post.mediaType)];

  return {
    provider: 'rules',
    model: 'rules-v1',
    normalizedText,
    domains: JSON.stringify(rulesResult.domains || []),
    mainTopics: JSON.stringify(rulesTopics),
    secondaryTopics: JSON.stringify(rulesResult.secondaryTopics || []),
    subjects: JSON.stringify((rulesResult.subjects || []).map(s => ({ id: s.id, label: s.label, themeId: s.themeId }))),
    preciseSubjects: '[]',
    persons: '[]',
    organizations: '[]',
    politicalActors: JSON.stringify(rulesResult.politicalActors || []),
    institutions: JSON.stringify(rulesResult.institutions || []),
    countries: '[]',
    politicalExplicitnessScore: rulesResult.politicalExplicitnessScore || 0,
    politicalIssueTags: JSON.stringify(rulesResult.politicalIssueTags || []),
    polarizationScore: rulesResult.polarizationScore || 0,
    ingroupOutgroupSignal: rulesResult.ingroupOutgroupSignal || false,
    conflictSignal: rulesResult.conflictSignal || false,
    moralAbsoluteSignal: rulesResult.moralAbsoluteSignal || false,
    enemyDesignationSignal: rulesResult.enemyDesignationSignal || false,
    activismSignal: rulesResult.activismSignal || false,
    axisEconomic: rulesResult.politicalAxes?.economic || 0,
    axisSocietal: rulesResult.politicalAxes?.societal || 0,
    axisAuthority: rulesResult.politicalAxes?.authority || 0,
    axisSystem: rulesResult.politicalAxes?.system || 0,
    dominantAxis: rulesResult.dominantAxis || '',
    mediaCategory: rulesResult.mediaCategory || '',
    mediaQuality: rulesResult.mediaQuality || '',
    confidenceScore: (rulesResult.confidenceScore || 0.3) * 0.6,
    reviewFlag: reviewFlag ? 1 : 0,
    reviewReason,
  };
}

// ── Merge rules + LLM ───────────────────────────────────────

function mergeLLMResult(
  enrichment: Record<string, any>,
  llm: LLMEnrichmentResult,
  rulesResult: ReturnType<typeof applyRulesShared>,
  post: UnenrichedPost,
  model: string,
): Record<string, any> {
  const polScore = Math.max(
    rulesResult.politicalExplicitnessScore || 0,
    llm.political_explicitness_score || 0,
  );
  const polarScore = Math.round(
    ((rulesResult.polarizationScore || 0) * 0.3 + (llm.polarization_score || 0) * 0.7) * 100,
  ) / 100;
  const conf = Math.round(
    ((rulesResult.confidenceScore || 0.3) * 0.3 + (llm.confidence_score || 0.5) * 0.7) * 100,
  ) / 100;

  const mergedTopics = llm.main_topics?.length ? llm.main_topics
    : rulesResult.mainTopics?.length ? rulesResult.mainTopics
    : [inferFallbackTopic(post.username, post.mediaType)];

  // Divergence detection → review flag
  const polDiv = Math.abs((rulesResult.politicalExplicitnessScore || 0) - (llm.political_explicitness_score || 0));
  const polarDiv = Math.abs((rulesResult.polarizationScore || 0) - (llm.polarization_score || 0));
  const needsReview = polDiv >= 2 || polarDiv > 0.4 || conf < 0.4;

  // ── L3: Subjects — merge rules + LLM ──
  const rulesSubjects = (rulesResult as any).subjects || [];
  const llmSubjects = (llm.subjects || []).map((s: string) => ({ id: s.toLowerCase().replace(/\s+/g, '_'), label: s }));
  const mergedSubjects = [...rulesSubjects];
  const seenSubjectIds = new Set(mergedSubjects.map((s: any) => s.id || s.label));
  for (const s of llmSubjects) {
    if (!seenSubjectIds.has(s.id)) mergedSubjects.push(s);
  }

  // ── L4: Precise subjects — validate against taxonomy ──
  const validPreciseSubjects = (llm.precise_subjects || [])
    .filter(ps => ps.id && getPreciseSubjectById(ps.id))
    .map(ps => ({
      id: ps.id,
      statement: getPreciseSubjectById(ps.id)!.ps.statement,
      position: ps.position,
      confidence: ps.confidence,
    }));

  // ── L5: Entities — merge rules + LLM ──
  const mergedActors = [...new Set([
    ...(rulesResult.politicalActors || []),
    ...(llm.persons || []),
  ])];
  const mergedInstitutions = [...new Set([
    ...(rulesResult.institutions || []),
    ...(llm.institutions || []),
  ])];

  return {
    ...enrichment,
    provider: 'openai',
    model,
    mainTopics: JSON.stringify(mergedTopics),
    secondaryTopics: JSON.stringify(llm.secondary_topics || []),
    subjects: JSON.stringify(mergedSubjects),
    preciseSubjects: JSON.stringify(validPreciseSubjects),
    persons: JSON.stringify(llm.persons || []),
    organizations: JSON.stringify(llm.organizations || []),
    institutions: JSON.stringify(mergedInstitutions),
    countries: JSON.stringify(llm.countries || []),
    politicalActors: JSON.stringify(mergedActors),
    politicalExplicitnessScore: polScore,
    polarizationScore: polarScore,
    confidenceScore: conf,
    tone: llm.tone || '',
    semanticSummary: llm.semantic_summary || '',
    primaryEmotion: llm.primary_emotion || '',
    narrativeFrame: llm.narrative_frame || '',
    callToActionType: llm.call_to_action_type || '',
    mediaHook: llm.media_hook || '',
    mediaMessage: llm.media_message || '',
    mediaIntent: llm.media_intent || '',
    ingroupOutgroupSignal: (llm as any).ingroup_outgroup_signal || enrichment.ingroupOutgroupSignal,
    conflictSignal: (llm as any).conflict_signal || enrichment.conflictSignal,
    moralAbsoluteSignal: (llm as any).moral_absolute_signal || enrichment.moralAbsoluteSignal,
    enemyDesignationSignal: (llm as any).enemy_designation_signal || enrichment.enemyDesignationSignal,
    activismSignal: (llm as any).activism_signal || enrichment.activismSignal,
    reviewFlag: needsReview ? 1 : 0,
    reviewReason: needsReview ? `divergence: pol=${polDiv}, polar=${polarDiv.toFixed(2)}` : '',
  };
}

// ── Main enrichment function with cascade ───────────────────

async function enrichPost(
  post: UnenrichedPost,
  llmConfig: LLMConfig | null,
): Promise<'success' | 'skipped' | 'failed'> {
  // ━━ Phase 1 — Agrégation texte (cascade de fallbacks) ━━
  // Injecter mlkitLabels et ocrText dans le post AVANT le rules engine
  // pour que le normalizedText soit le plus riche possible
  const enrichedPost = { ...post };
  const extraSignals: string[] = [];

  // mlkitLabels → texte lisible
  if (post.mlkitLabels) {
    try {
      const labels = JSON.parse(post.mlkitLabels);
      if (Array.isArray(labels) && labels.length > 0) {
        extraSignals.push(labels.join(', '));
      }
    } catch { /* */ }
  }

  // ocrText déjà dans post, mais on s'assure qu'il est dans allText
  if (post.ocrText?.trim() && !post.allText?.includes(post.ocrText)) {
    extraSignals.push(post.ocrText.trim());
  }

  // imageAlts — parfois riche (alt text ML des images)
  if (post.imageAlts) {
    try {
      const alts = JSON.parse(post.imageAlts);
      if (Array.isArray(alts)) {
        const altText = alts.filter(Boolean).join(' ');
        if (altText.length > 10 && !post.allText?.includes(altText)) {
          extraSignals.push(altText);
        }
      }
    } catch { /* */ }
  }

  // Ajouter les signaux au allText pour que le rules engine en bénéficie
  if (extraSignals.length > 0) {
    enrichedPost.allText = (post.allText || '') + ' ' + extraSignals.join(' ');
  }

  // ━━ Phase 1b — Rules engine ━━
  const rulesResult = applyRulesFromShared(enrichedPost);
  if (!rulesResult) {
    log(`skip @${post.username} — rules engine error`);
    return 'skipped';
  }

  let normalizedText = rulesResult.normalizedText || '';

  // Dernier fallback : username seul (pour les comptes connus)
  if (normalizedText.length < 10 && post.username) {
    normalizedText = (normalizedText + ' ' + post.username).trim();
  }

  const words = normalizedText.split(/\s+/).filter((w: string) => w.length > 2);
  if (words.length < 1) {
    return 'skipped';
  }

  // ━━ Phase 2 — Signal vidéo (si video/reel + confiance basse) ━━
  let videoSource: 'ocr' | 'whisper' | 'none' = 'none';
  if (['video', 'reel'].includes(post.mediaType) && rulesResult.confidenceScore < 0.65) {
    const videoSignal = await enrichVideoSignal(post, normalizedText, llmConfig);
    if (videoSignal.text) {
      normalizedText = normalizedText + '\n\n' + videoSignal.text;
      videoSource = videoSignal.source;
    }
  }

  // ━━ Phase 3 — Décision : quel niveau d'enrichissement ? ━━
  const level = selectEnrichmentLevel(
    rulesResult.confidenceScore,
    post,
    llmConfig,
    videoSource !== 'none',
  );

  let enrichment = buildRulesEnrichment(rulesResult, normalizedText, post);

  if (level === 'rules-only') {
    log(`@${post.username} — rules-only conf=${enrichment.confidenceScore} [${rulesResult.mainTopics}]`);
    // Add audio transcription if captured
    if (videoSource === 'whisper') {
      enrichment.audioTranscription = normalizedText.split('[AUDIO_TRANSCRIPT] ')[1] || '';
    }
  } else if (level === 'text-llm' || level === 'vision') {
    try {
      const hashtags = safeParseArray(post.hashtags);
      let llmResponse;

      if (level === 'vision') {
        // Vision mode — image + texte
        const images = safeParseArray(post.imageUrls);
        const { callOpenAIVision } = await import('./llm-mobile');
        llmResponse = await callOpenAIVision(
          images[0],
          { normalizedText, username: post.username, hashtags, mediaType: post.mediaType },
          llmConfig!,
        );
        log(`@${post.username} — vision used`);
      } else {
        // Build candidate precise subjects from detected themes
        const candidatePreciseSubjects: { id: string; statement: string }[] = [];
        for (const tId of rulesResult.mainTopics) {
          const ps = getPreciseSubjectsForTheme(tId);
          for (const p of ps) candidatePreciseSubjects.push({ id: p.id, statement: p.statement });
        }

        // Text-only LLM
        const prompt = buildEnrichmentPrompt({
          normalizedText,
          username: post.username,
          hashtags,
          mediaType: post.mediaType,
          rulesHints: {
            mainTopics: rulesResult.mainTopics,
            politicalScore: rulesResult.politicalExplicitnessScore,
            polarizationScore: rulesResult.polarizationScore,
            detectedActors: rulesResult.politicalActors,
          },
          candidatePreciseSubjects: candidatePreciseSubjects.length > 0 ? candidatePreciseSubjects : undefined,
        });

        const messages: LLMMessage[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ];
        llmResponse = await callOpenAI(messages, llmConfig!);
      }

      const llm: LLMEnrichmentResult = JSON.parse(llmResponse.content);
      enrichment = mergeLLMResult(enrichment, llm, rulesResult, post, llmResponse.model);

      if (videoSource === 'whisper') {
        enrichment.audioTranscription = normalizedText.split('[AUDIO_TRANSCRIPT] ')[1] || '';
      }

      log(`@${post.username} — ${level} pol=${enrichment.politicalExplicitnessScore} conf=${enrichment.confidenceScore}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`LLM error @${post.username}: ${msg} — fallback rules`);
    }
  }

  // ━━ Persist ━━
  try {
    await saveEnrichment(post.id, enrichment);

    // ━━ Graph ingest ━━
    try {
      const graphResult = await graphIngestMobile(post.id, enrichment as MobileEnrichment);
      if (graphResult.observationCount > 0) {
        log(`graph @${post.username}: ${graphResult.observationCount} obs`);
      }
    } catch (graphErr) {
      // Non-blocking — enrichment already persisted
      log(`graph error @${post.username}: ${graphErr instanceof Error ? graphErr.message : graphErr}`);
    }

    return 'success';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`persist error @${post.username}: ${msg}`);
    return 'failed';
  }
}

async function tick() {
  if (processing || !config) return;
  processing = true;

  try {
    stats.lastCheckAt = new Date().toISOString();
    const pending = await countPending();
    stats.pendingPosts = pending;

    const llmConfig: LLMConfig | null = config.rulesOnly
      ? null
      : { apiKey: config.apiKey, model: config.model };

    // Check if there are rules-only posts needing LLM (even if no unenriched)
    let rulesOnlyCount = 0;
    if (llmConfig && pending < config.threshold) {
      const rulesOnlyPosts = await fetchRulesOnlyPosts(1);
      rulesOnlyCount = rulesOnlyPosts.length;
    }

    if (pending < config.threshold && rulesOnlyCount === 0) {
      log(`${pending} post(s) en attente (seuil: ${config.threshold}) — skip`);
      notify();
      return;
    }

    // ━━ Phase rapide : rules-only bulk (only if unenriched posts exist) ━━
    stats.rulesCount = 0;
    stats.llmCount = 0;
    stats.llmEnabled = !!llmConfig;

    let posts: UnenrichedPost[] = [];
    if (pending > 0) {
      const bulkSize = Math.min(pending, config.batchSize || 1000);
      stats.phase = 'rules';
      stats.tickTotal = bulkSize;
      log(`[tick] ${pending} posts en attente — rules bulk (${bulkSize})${llmConfig ? ' + LLM' : ' (rules-only)'}`);
      notify();

      posts = await fetchUnenriched(bulkSize);
      stats.tickTotal = posts.length;
      log(`[tick] fetchUnenriched returned ${posts.length} posts`);
    } else {
      log(`[tick] 0 nouveaux posts — passage direct au LLM`);
    }

    for (const post of posts) {
      const result = await enrichPost(post, null); // rules-only, pas de LLM
      stats.totalProcessed++;
      if (result === 'success') { stats.totalSucceeded++; stats.rulesCount++; }
      else if (result === 'failed') stats.totalFailed++;
      else {
        stats.totalSkipped++;
        try {
          await saveEnrichment(post.id, {
            provider: 'skipped', model: 'none', version: '1',
            mainTopics: '[]', domains: '[]', tone: 'neutre', confidenceScore: 0,
          });
        } catch { /* */ }
      }
      if (stats.totalProcessed % 20 === 0) notify();
    }

    stats.lastEnrichAt = new Date().toISOString();
    log(`Rules bulk terminé: ${stats.rulesCount} enrichis, ${stats.totalSkipped} skippés`);
    notify();

    // ━━ Phase LLM batch : raffiner par groupes de 5 en un seul appel ━━
    if (llmConfig) {
      const BATCH_SIZE = 10;

      // Fetch posts needing LLM refinement (rules-only or skipped provider)
      let llmCandidates = posts; // from this tick
      if (llmCandidates.length === 0) {
        // No new posts this tick — look for rules-only posts needing LLM upgrade
        llmCandidates = await fetchRulesOnlyPosts(config.batchSize || 100);
        if (llmCandidates.length > 0) {
          log(`[tick] ${llmCandidates.length} posts rules-only a raffiner par LLM`);
        }
      }

      // Préparer les posts pour le batch LLM
      const batchPosts: { post: UnenrichedPost; rulesResult: ReturnType<typeof applyRulesShared>; normalizedText: string }[] = [];
      for (const post of llmCandidates) {
        const enrichedPost = { ...post };
        const extra: string[] = [];
        if (post.mlkitLabels) { try { const l = JSON.parse(post.mlkitLabels); if (Array.isArray(l) && l.length) extra.push(l.join(', ')); } catch {} }
        if (post.ocrText?.trim() && !post.allText?.includes(post.ocrText)) extra.push(post.ocrText.trim());
        if (post.imageAlts) { try { const a = JSON.parse(post.imageAlts); if (Array.isArray(a)) { const t = a.filter(Boolean).join(' '); if (t.length > 10) extra.push(t); } } catch {} }
        if (extra.length) enrichedPost.allText = (post.allText || '') + ' ' + extra.join(' ');
        const rr = applyRulesFromShared(enrichedPost);
        if (!rr) continue;
        const nt = rr.normalizedText || '';
        if (nt.split(/\s+/).filter((w: string) => w.length > 2).length < 2) continue;
        batchPosts.push({ post, rulesResult: rr, normalizedText: nt });
      }

      stats.phase = 'llm';
      stats.tickTotal = batchPosts.length;
      log(`LLM batch: ${batchPosts.length} posts, groupes de ${BATCH_SIZE}`);
      notify();
      let llmDone = 0;

      const PARALLEL = 5; // concurrent API calls
      for (let i = 0; i < batchPosts.length; i += BATCH_SIZE * PARALLEL) {
        // Launch PARALLEL chunks concurrently
        const parallelChunks = [];
        for (let p = 0; p < PARALLEL; p++) {
          const start = i + p * BATCH_SIZE;
          if (start >= batchPosts.length) break;
          parallelChunks.push(batchPosts.slice(start, start + BATCH_SIZE));
        }

        const parallelResults = await Promise.allSettled(parallelChunks.map(chunk => {
          const batchInput: BatchPost[] = chunk.map((c, idx) => ({
            index: idx,
            username: c.post.username,
            normalizedText: c.normalizedText,
            hashtags: safeParseArray(c.post.hashtags),
            mediaType: c.post.mediaType,
            rulesHints: {
              mainTopics: c.rulesResult.mainTopics,
              politicalScore: c.rulesResult.politicalExplicitnessScore,
              polarizationScore: c.rulesResult.polarizationScore,
              detectedActors: c.rulesResult.politicalActors,
            },
          }));
          return callOpenAIBatch(batchInput, llmConfig).then(results => ({ chunk, results }));
        }));

        for (const settled of parallelResults) {
          if (settled.status !== 'fulfilled') {
            log(`[LLM] parallel chunk error: ${(settled as any).reason?.message || 'unknown'}`);
            continue;
          }
          const { chunk, results } = settled.value;

          // Merge et save chaque résultat
          for (const r of results) {
            const idx = r.index;
            if (idx < 0 || idx >= chunk.length) continue;
            const c = chunk[idx];
            try {
              let enrichment = buildRulesEnrichment(c.rulesResult, c.normalizedText, c.post);
              enrichment = mergeLLMResult(enrichment, {
                semantic_summary: r.result.semantic_summary || '',
                main_topics: r.result.main_topics || [],
                secondary_topics: r.result.secondary_topics || [],
                subjects: r.result.subjects || [],
                precise_subjects: r.result.precise_subjects || [],
                persons: r.result.persons || [],
                organizations: r.result.organizations || [],
                institutions: r.result.institutions || [],
                countries: r.result.countries || [],
                tone: r.result.tone || '',
                primary_emotion: r.result.primary_emotion || '',
                emotion_intensity: r.result.emotion_intensity || 0,
                political_explicitness_score: r.result.political_explicitness_score || 0,
                polarization_score: r.result.polarization_score || 0,
                narrative_frame: r.result.narrative_frame || '',
                call_to_action_type: r.result.call_to_action_type || '',
                media_hook: r.result.media_hook || '',
                media_message: r.result.media_message || '',
                media_intent: r.result.media_intent || '',
                confidence_score: r.result.confidence_score || 0.5,
              }, c.rulesResult, c.post, 'gpt-4o-mini-batch');
              await saveEnrichment(c.post.id, enrichment);
              // Graph ingest after LLM refinement
              try { await graphIngestMobile(c.post.id, enrichment as MobileEnrichment); } catch { /* non-blocking */ }
              llmDone++;
              stats.llmCount = llmDone;
            } catch { /* skip individual merge errors */ }
          }

          log(`LLM batch: ${llmDone}/${batchPosts.length}`);
          notify();
        } // end for settled
      } // end for i

      stats.llmCount = llmDone;
      stats.phase = 'done';
      log(`LLM batch terminé: ${llmDone} posts raffinés`);
      notify();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 3).join(' | ') : '';
    log(`[tick] ERREUR: ${msg} ${stack}`);
  } finally {
    processing = false;
    stats.phase = 'idle';
    notify();
    log(`[tick] fin — processed=${stats.totalProcessed} ok=${stats.totalSucceeded} fail=${stats.totalFailed} skip=${stats.totalSkipped} rules=${stats.rulesCount} llm=${stats.llmCount}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Public API ───────────────────────────────────────────────

export function startDaemon(daemonConfig: DaemonConfig): void {
  if (stats.running) {
    log('Daemon déjà en cours');
    return;
  }

  config = daemonConfig;
  stats.running = true;

  log(`Démarré — intervalle: ${config.intervalSec}s, batch: ${config.batchSize}, seuil: ${config.threshold}, LLM: ${config.rulesOnly ? 'non' : 'oui'}`);
  notify();

  // Dedup existing posts on first start
  const plugin = getPlugin();
  if (plugin?.deduplicatePosts) {
    plugin.deduplicatePosts().then((r: any) => {
      if (r.removed > 0) log(`Dedup: ${r.removed} doublons supprimés`);
    }).catch(() => {});
  }

  // Premier tick immédiat
  tick();

  // Puis périodique
  intervalHandle = setInterval(() => tick(), config.intervalSec * 1000);
}

export function stopDaemon(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  stats.running = false;
  config = null;
  log(`Arrêté — total: ${stats.totalSucceeded} enrichis`);
  notify();
}

export function getDaemonStatus(): DaemonStatus {
  return { ...stats };
}

export function onStatusChange(fn: (status: DaemonStatus) => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter(l => l !== fn);
  };
}

/** Déclenche un enrichissement immédiat (hors cycle) */
export async function triggerNow(): Promise<void> {
  if (processing) {
    log('Enrichissement déjà en cours');
    return;
  }
  await tick();
}
