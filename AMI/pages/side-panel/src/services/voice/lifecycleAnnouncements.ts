import type { SpeechRequest } from './textToSpeech';

export const LIFECYCLE_ANNOUNCEMENTS = {
  accepted: "J'ai compris...",
  planning: 'Je reflechis au plan...',
  started: 'Je commence...',
  progress: 'Je suis en train de...',
  finalizing: 'Je finalise...',
  completed: "C'est terminé...",
  summaryPrefix: 'Resumé...',
} as const;

const TECHNICAL_PATTERNS = [
  /showing progress/i,
  /\btask[_ ]?id\b/i,
  /\bexecutionstate\b/i,
  /\bchrome\.runtime\b/i,
  /\bside-panel-connection\b/i,
  /\bundefined\b/i,
  /\bnull\b/i,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
];

export function sanitizeSpeechContent(content?: string | null, maxLength = 180): string {
  const normalized = (content || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return '';
  }

  if (TECHNICAL_PATTERNS.some(pattern => pattern.test(normalized))) {
    return '';
  }

  return normalized.slice(0, maxLength);
}

export function buildCompletionAnnouncements(content?: string | null, taskId?: string | null): SpeechRequest[] {
  const requests: SpeechRequest[] = [
    {
      text: LIFECYCLE_ANNOUNCEMENTS.completed,
      interrupt: true,
    },
  ];

  const summary = sanitizeSpeechContent(content);
  if (summary && summary !== taskId) {
    requests.push({
      text: `${LIFECYCLE_ANNOUNCEMENTS.summaryPrefix} ${summary}`,
    });
  }

  return requests;
}

function ensureSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function shortenForSpeech(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const shortened = text.slice(0, maxLength).trim();
  const lastBreak = Math.max(shortened.lastIndexOf('.'), shortened.lastIndexOf(','), shortened.lastIndexOf(' '));
  return (lastBreak > 40 ? shortened.slice(0, lastBreak) : shortened).trim();
}

export function buildAccessibleSummary(taskText?: string | null, finalContent?: string | null): string {
  const task = sanitizeSpeechContent(taskText, 120);
  const result = sanitizeSpeechContent(finalContent, 240);

  if (!task && !result) {
    return 'Resume... La demande a ete traitee. Le resultat final est disponible.';
  }

  const sentences: string[] = [];

  if (task) {
    sentences.push(ensureSentence(`J'ai compris la demande suivante : ${shortenForSpeech(task, 110)}`));
  }

  if (task) {
    sentences.push(ensureSentence(`J'ai execute la tache demandee pour atteindre cet objectif`));
  }

  if (result) {
    sentences.push(ensureSentence(`Resultat final : ${shortenForSpeech(result, 150)}`));
  } else {
    sentences.push(ensureSentence(`Le resultat final est pret dans la conversation`));
  }

  if (result) {
    sentences.push(ensureSentence(`Vous pouvez maintenant verifier ce resultat ou demander une suite`));
  }

  return `${LIFECYCLE_ANNOUNCEMENTS.summaryPrefix} ${sentences.slice(0, 4).join(' ')}`.trim();
}

export function buildNextSuggestedAction(finalContent?: string | null): string {
  const result = sanitizeSpeechContent(finalContent, 120);

  if (!result) {
    return 'Action suivante suggeree... Demandez un resume plus detaille ou une suite.';
  }

  return 'Action suivante suggeree... Verifiez le resultat, puis demandez une correction ou une etape suivante si besoin.';
}

const ACTION_NOISE_PATTERNS = [/^navigating$/i, /^navigation done$/i, /^planning$/i, /^cache_content$/i, /^done$/i];

export function buildExecutionAnnouncement(content?: string | null): string {
  const sanitized = sanitizeSpeechContent(content, 90);

  if (!sanitized || ACTION_NOISE_PATTERNS.some(pattern => pattern.test(sanitized))) {
    return LIFECYCLE_ANNOUNCEMENTS.progress;
  }

  return `${LIFECYCLE_ANNOUNCEMENTS.progress} ${sanitized}`;
}
