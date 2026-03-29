/**
 * Rules Engine Shared — importe directement les dictionnaires et le rules-engine
 * depuis le code source partagé (src/enrichment/).
 *
 * Remplace l'ancien enrichment.js (copie vanilla JS des dictionnaires).
 * Bundlé par Vite dans le build mobile.
 */

// Import from shared enrichment source
import { classifyTopicsEnriched, getDomainsFromThemes, normalizeTopics, getPreciseSubjectsForTheme } from '@shared/dictionaries';
import { detectPoliticalActors, analyzeHashtags, detectPolarization, detectPoliticalAxes, classifyMedia, detectPoliticalAccount } from '@shared/dictionaries';
import { normalizePostText } from '@shared/normalize';
import { applyTopicCorrections } from '@shared/topic-corrections';

export interface RulesInput {
  username: string;
  caption: string;
  fullCaption?: string;
  imageAlts?: string | string[];
  allText: string;
  hashtags: string[];
  ocrText?: string;
  subtitles?: string;
  mlkitLabelsText?: string;
  isSponsored?: boolean;
}

export interface RulesOutput {
  mainTopics: string[];
  secondaryTopics: string[];
  domains: string[];
  subjects: { id: string; label: string; themeId: string; matchCount: number }[];
  politicalActors: string[];
  institutions: string[];
  activismSignal: boolean;
  politicalExplicitnessScore: number;
  politicalIssueTags: string[];
  polarizationScore: number;
  ingroupOutgroupSignal: boolean;
  conflictSignal: boolean;
  moralAbsoluteSignal: boolean;
  enemyDesignationSignal: boolean;
  politicalAxes: { economic: number; societal: number; authority: number; system: number };
  dominantAxis: string | null;
  mediaCategory: string;
  mediaQuality: string;
  confidenceScore: number;
  normalizedText: string;
  language: string;
}

/**
 * Fallback topic when neither rules nor LLM found any topics.
 * Infers from username patterns and mediaType.
 */
export function inferFallbackTopic(username: string, mediaType: string): string {
  const u = (username || '').toLowerCase();

  const domainSignals: [string[], string][] = [
    [['food', 'cook', 'cuisine', 'chef', 'restaurant', 'fork', 'eat', 'recipe', 'boulang', 'patisser'], 'lifestyle'],
    [['game', 'gaming', 'gamer', 'esport', 'boardgame', 'dice', 'meeple', 'tabletop', 'ludo'], 'divertissement'],
    [['art', 'draw', 'paint', 'illustrat', 'design', 'photo', 'gallery'], 'culture'],
    [['music', 'musique', 'dj', 'beat', 'rap', 'rock', 'jazz'], 'culture'],
    [['fitness', 'gym', 'muscle', 'workout', 'sport', 'running', 'marathon'], 'sport'],
    [['beauty', 'beaute', 'makeup', 'skincare', 'cosmetic', 'hair', 'nail'], 'beaute'],
    [['fashion', 'mode', 'style', 'wear', 'outfit', 'dior', 'chanel', 'gucci', 'vuitton', 'zara'], 'beaute'],
    [['tech', 'dev', 'code', 'hack', 'ai', 'startup', 'software', 'digital'], 'technologie'],
    [['news', 'info', 'journal', 'actu', 'media', 'presse', 'reporter'], 'actualite'],
    [['yoga', 'meditat', 'mindful', 'zen', 'spirit', 'coach'], 'developpement_personnel'],
    [['crypto', 'bitcoin', 'trading', 'invest', 'business', 'entrepreneur'], 'business'],
    [['humour', 'humor', 'comedy', 'fun', 'lol', 'meme', 'blague'], 'humour'],
    [['travel', 'voyage', 'trip', 'wander', 'explore', 'nomad'], 'lifestyle'],
  ];

  for (const [signals, topic] of domainSignals) {
    if (signals.some(s => u.includes(s))) return topic;
  }

  if (mediaType === 'reel' || mediaType === 'video') return 'divertissement';
  return 'lifestyle';
}

/**
 * Apply rules engine on a post — single source of truth, shared with PC pipeline.
 */
export function applyRulesShared(input: RulesInput): RulesOutput {
  // Normalize input
  const alts = Array.isArray(input.imageAlts) ? input.imageAlts.join(' ') : (input.imageAlts || '');

  const normalization = normalizePostText({
    caption: input.caption || '',
    imageDesc: alts,
    allText: input.allText || input.fullCaption || '',
    hashtags: input.hashtags || [],
    ocrText: input.ocrText,
    subtitles: input.subtitles,
    mlkitLabelsText: input.mlkitLabelsText,
  });

  const { normalizedText, language } = normalization;
  const textForAnalysis = `${normalizedText} ${input.username || ''}`;

  // Topics (multi-level)
  const enriched = classifyTopicsEnriched(textForAnalysis);
  const topicResults = enriched.themes;
  const mainTopics = topicResults.slice(0, 3).map(t => t.id);
  const secondaryTopics = topicResults.slice(3, 6).map(t => t.id);
  const allTopicIds = [...mainTopics, ...secondaryTopics];
  const domains = getDomainsFromThemes(allTopicIds);
  const subjects = enriched.subjects;

  // Apply topic corrections
  applyTopicCorrections(mainTopics, secondaryTopics, input.username || '', normalizedText);

  // Political actors
  const actors = detectPoliticalActors(textForAnalysis);
  const allPoliticalActors = [...actors.parties, ...actors.figures];

  // Hashtags
  const hashtagResult = analyzeHashtags(input.hashtags || []);

  // Political score (0-4)
  let politicalScore = hashtagResult.politicalLevel;
  if (actors.figures.length > 0) politicalScore = Math.max(politicalScore, 3);
  if (actors.parties.length > 0) politicalScore = Math.max(politicalScore, 3);
  if (actors.institutions.length >= 2) politicalScore = Math.max(politicalScore, 2);
  else if (actors.institutions.length > 0) politicalScore = Math.max(politicalScore, 1);
  if (actors.activismTerms.length >= 2) politicalScore = Math.max(politicalScore, 4);
  else if (actors.activismTerms.length > 0) politicalScore = Math.max(politicalScore, 3);

  const politicalIssueTags: string[] = [];
  const politicalTopics = ['politique', 'geopolitique', 'immigration', 'securite', 'justice', 'ecologie'];
  for (const t of topicResults) {
    if (politicalTopics.includes(t.id)) politicalIssueTags.push(t.id);
  }
  if (politicalIssueTags.length > 0 && politicalScore < 2) politicalScore = 2;

  // Known political accounts
  const knownAccount = detectPoliticalAccount(input.username || '');
  if (knownAccount) {
    politicalScore = Math.max(politicalScore, knownAccount.minPoliticalScore);
    for (const tag of knownAccount.tags) {
      if (!politicalIssueTags.includes(tag)) politicalIssueTags.push(tag);
    }
  }

  // Polarization
  const polarization = detectPolarization(textForAnalysis);
  let adjustedPolarization = polarization.score;
  if (hashtagResult.politicalLevel >= 3 && polarization.score > 0.1) {
    adjustedPolarization = Math.min(adjustedPolarization * 1.3, 1);
  }

  // Political axes
  const axes = detectPoliticalAxes(textForAnalysis);

  // Media classification
  const media = classifyMedia(textForAnalysis, input.isSponsored || false);

  // Confidence
  const textLength = normalizedText.length;
  const signalCount = topicResults.length + allPoliticalActors.length + hashtagResult.politicalHashtags.length;
  let confidence = 0.3;
  if (textLength > 100) confidence += 0.2;
  if (textLength > 300) confidence += 0.1;
  if (signalCount >= 3) confidence += 0.2;
  if (signalCount >= 6) confidence += 0.1;
  if ((input.hashtags || []).length > 0) confidence += 0.1;
  confidence = Math.min(confidence, 1);

  return {
    mainTopics,
    secondaryTopics,
    domains,
    subjects,
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
    normalizedText,
    language,
  };
}
