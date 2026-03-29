/**
 * Rules Engine — Couche 1 de l'enrichissement.
 * Scoring rule-based à partir des dictionnaires.
 * Produit un enrichissement partiel qui sera complété par le LLM.
 */
import { detectPoliticalActors, analyzeHashtags, detectPolarization, classifyTopicsEnriched, detectPoliticalAxes, classifyMedia, detectPoliticalAccount, getDomainsFromThemes, getPreciseSubjectsForTheme } from './dictionaries';
import type { AxisScore } from './dictionaries';

export interface SubjectMatch {
  id: string;
  label: string;
  themeId: string;
  matchCount: number;
}

export interface RulesResult {
  // Catégorisation (niveaux 1-3)
  domains: string[];
  mainTopics: string[];
  secondaryTopics: string[];
  subjects: SubjectMatch[];
  candidatePreciseSubjectIds: string[];

  // Entités politiques
  politicalActors: string[];
  institutions: string[];
  activismSignal: boolean;

  // Score politique (0-4)
  politicalExplicitnessScore: number;
  politicalIssueTags: string[];

  // Polarisation (0-1) + signaux
  polarizationScore: number;
  ingroupOutgroupSignal: boolean;
  conflictSignal: boolean;
  moralAbsoluteSignal: boolean;
  enemyDesignationSignal: boolean;

  // Axes politiques (political compass)
  politicalAxes: AxisScore;
  dominantAxis: string | null;

  // Catégorie média
  mediaCategory: string;
  mediaQuality: string;

  // Confiance
  confidenceScore: number;

  // Debug
  _debug: {
    hashtagAnalysis: ReturnType<typeof analyzeHashtags>;
    politicalActorMatches: ReturnType<typeof detectPoliticalActors>;
    polarizationMatches: Record<string, string[]>;
    topicMatches: { id: string; matchCount: number }[];
    axesMatches: Record<string, { negative: string[]; positive: string[] }>;
  };
}

/**
 * Applique les règles d'enrichissement sur un post.
 */
export function applyRules(input: {
  normalizedText: string;
  hashtags: string[];
  username: string;
  isSponsored?: boolean;
}): RulesResult {
  const { normalizedText, hashtags, username } = input;
  const textForAnalysis = `${normalizedText} ${username}`;

  // ── Classification multi-niveaux ──
  const enriched = classifyTopicsEnriched(textForAnalysis);
  const topicResults = enriched.themes;
  const mainTopics = topicResults.slice(0, 3).map(t => t.id);
  const secondaryTopics = topicResults.slice(3, 6).map(t => t.id);
  const allTopicIds = [...mainTopics, ...secondaryTopics];
  const domains = getDomainsFromThemes(allTopicIds);
  const subjects: SubjectMatch[] = enriched.subjects.slice(0, 10).map(s => ({
    id: s.id,
    label: s.label,
    themeId: s.themeId,
    matchCount: s.matchCount,
  }));

  // Sujets précis candidats (ceux rattachés aux thèmes détectés, pour le LLM)
  const candidatePreciseSubjectIds: string[] = [];
  for (const tId of mainTopics) {
    const ps = getPreciseSubjectsForTheme(tId);
    for (const p of ps) candidatePreciseSubjectIds.push(p.id);
  }

  // ── Acteurs politiques ──
  const actors = detectPoliticalActors(textForAnalysis);
  const allPoliticalActors = [...actors.parties, ...actors.figures];

  // ── Hashtags ──
  const hashtagResult = analyzeHashtags(hashtags);

  // ── Score politique (0-4) ──
  // Combine signaux : acteurs détectés, hashtags, termes militants
  let politicalScore = hashtagResult.politicalLevel;

  if (actors.figures.length > 0) politicalScore = Math.max(politicalScore, 3);
  if (actors.parties.length > 0) politicalScore = Math.max(politicalScore, 3);
  if (actors.institutions.length >= 2) politicalScore = Math.max(politicalScore, 2);
  else if (actors.institutions.length > 0) politicalScore = Math.max(politicalScore, 1);
  if (actors.activismTerms.length >= 2) politicalScore = Math.max(politicalScore, 4);
  else if (actors.activismTerms.length > 0) politicalScore = Math.max(politicalScore, 3);

  // Tags d'enjeux politiques détectés
  const politicalIssueTags: string[] = [];
  const politicalTopics = ['politique', 'geopolitique', 'immigration', 'securite', 'justice', 'ecologie'];
  for (const t of topicResults) {
    if (politicalTopics.includes(t.id)) politicalIssueTags.push(t.id);
  }
  if (politicalIssueTags.length > 0 && politicalScore < 2) politicalScore = 2;

  // ── Comptes politiques connus ──
  const knownAccount = detectPoliticalAccount(username);
  if (knownAccount) {
    politicalScore = Math.max(politicalScore, knownAccount.minPoliticalScore);
    for (const tag of knownAccount.tags) {
      if (!politicalIssueTags.includes(tag)) politicalIssueTags.push(tag);
    }
  }

  // ── Polarisation ──
  const polarization = detectPolarization(textForAnalysis);

  // Bonus polarisation si hashtags militants + vocabulaire conflictuel
  let adjustedPolarization = polarization.score;
  if (hashtagResult.politicalLevel >= 3 && polarization.score > 0.1) {
    adjustedPolarization = Math.min(adjustedPolarization * 1.3, 1);
  }

  // ── Axes politiques ──
  const axes = detectPoliticalAxes(textForAnalysis);

  // ── Catégorie média ──
  const media = classifyMedia(textForAnalysis, input.isSponsored || false);

  // ── Confiance ──
  // Plus le texte est long et riche en signaux, plus la confiance est haute
  const textLength = normalizedText.length;
  const signalCount = topicResults.length + allPoliticalActors.length + hashtagResult.politicalHashtags.length;
  let confidence = 0.3; // base
  if (textLength > 100) confidence += 0.2;
  if (textLength > 300) confidence += 0.1;
  if (signalCount >= 3) confidence += 0.2;
  if (signalCount >= 6) confidence += 0.1;
  if (hashtags.length > 0) confidence += 0.1;
  confidence = Math.min(confidence, 1);

  return {
    domains,
    mainTopics,
    secondaryTopics,
    subjects,
    candidatePreciseSubjectIds,
    politicalActors: allPoliticalActors,
    institutions: actors.institutions,
    activismSignal: actors.activismTerms.length > 0 || hashtagResult.politicalLevel >= 4,
    politicalExplicitnessScore: Math.min(politicalScore, 4),
    politicalIssueTags,
    polarizationScore: Math.round(adjustedPolarization * 100) / 100,
    ingroupOutgroupSignal: polarization.signals.ingroupOutgroup,
    conflictSignal: polarization.signals.conflict,
    moralAbsoluteSignal: polarization.signals.moralAbsolute,
    enemyDesignationSignal: polarization.signals.enemyDesignation,
    politicalAxes: axes.scores,
    dominantAxis: axes.dominant,
    mediaCategory: media.category,
    mediaQuality: media.quality,
    confidenceScore: Math.round(confidence * 100) / 100,
    _debug: {
      hashtagAnalysis: hashtagResult,
      politicalActorMatches: actors,
      polarizationMatches: polarization.matches,
      topicMatches: topicResults.map(t => ({ id: t.id, matchCount: t.matchCount })),
      axesMatches: axes.matches,
    },
  };
}
