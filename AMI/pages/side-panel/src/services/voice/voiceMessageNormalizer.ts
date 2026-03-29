const NON_SPEAKABLE_MESSAGES = new Set(['je suis en train de...', 'resume...', 'action suivante suggeree...']);

const TECHNICAL_PATTERNS = [
  /showing progress/i,
  /^planning$/i,
  /^navigating$/i,
  /^navigation done$/i,
  /^done$/i,
  /^cache_content$/i,
  /\btask[_ ]?id\b/i,
  /\bexecutionstate\b/i,
  /\bchrome\.runtime\b/i,
  /\bside-panel-connection\b/i,
  /\bundefined\b/i,
  /\bnull\b/i,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
];

function compact(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function stripTechnicalContent(text?: string | null, maxLength = 140): string {
  const normalized = compact((text || '').replace(/https?:\/\/\S+/g, '').replace(/<[^>]+>/g, ' '));

  if (!normalized) {
    return '';
  }

  if (TECHNICAL_PATTERNS.some(pattern => pattern.test(normalized))) {
    return '';
  }

  return normalized.slice(0, maxLength).trim();
}

function translateInternalText(text: string): string {
  const normalized = text.toLowerCase();

  if (normalized === 'planning') return 'Je prepare un plan.';
  if (normalized === 'navigating' || normalized === 'opening') return "J'ouvre la page.";
  if (normalized === 'navigation done' || normalized === 'done') return 'Je poursuis.';
  if (normalized === 'search google') return 'Je lance la recherche.';
  if (normalized.includes('compare')) return 'Je compare les resultats.';
  if (normalized.includes('click')) return 'Je selectionne un element.';
  if (normalized.includes('typing') || normalized.includes('input')) return 'Je remplis un champ.';
  if (normalized.includes('scroll')) return 'Je parcours la page.';

  return text;
}

function toSentence(text: string): string {
  const normalized = compact(text);
  if (!normalized) {
    return '';
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function shorten(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const slice = text.slice(0, maxLength).trim();
  const lastBreak = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf(','), slice.lastIndexOf('.'));
  return (lastBreak > 30 ? slice.slice(0, lastBreak) : slice).trim();
}

export function normalizeVoiceText(text?: string | null): string {
  const normalized = compact(text || '');

  if (!normalized) {
    return '';
  }

  const translated = compact(translateInternalText(normalized));

  if (NON_SPEAKABLE_MESSAGES.has(translated.toLowerCase())) {
    return '';
  }

  if (TECHNICAL_PATTERNS.some(pattern => pattern.test(translated))) {
    return '';
  }

  return translated;
}

export function buildMicrophoneListeningMessage(): string {
  return "Je t'écoute.";
}

export function buildAcceptedMessage(transcript: string): string {
  const cleaned = stripTechnicalContent(transcript, 90);
  if (!cleaned) {
    return "J'ai compris votre demande.";
  }

  return `J'ai compris : ${cleaned}.`;
}

export function buildPlanningMessage(): string {
  return 'Je prepare un plan.';
}

export function buildExecutionStartedMessage(): string {
  return 'Je commence.';
}

function mapEnglishActionToFrench(content: string): string {
  const normalized = content.toLowerCase();

  if (normalized.includes('planning')) return buildPlanningMessage();
  if (normalized.includes('navigating to') || normalized.includes('open tab') || normalized.includes('opening')) {
    return "J'ouvre la page.";
  }
  if (normalized.includes('search google')) return 'Je lance la recherche.';
  if (normalized.includes('click')) return 'Je selectionne un element.';
  if (normalized.includes('input') || normalized.includes('typing')) return 'Je remplis un champ.';
  if (normalized.includes('switch tab')) return "Je change d'onglet.";
  if (normalized.includes('go back')) return 'Je reviens en arriere.';
  if (normalized.includes('scroll')) return 'Je parcours la page.';
  if (normalized.includes('select')) return 'Je choisis une option.';
  if (normalized.includes('wait')) return 'Je verifie les informations.';
  if (normalized.includes('compare')) return 'Je compare les resultats.';
  if (normalized.includes('cache')) return '';

  return '';
}

export function buildExecutionStepMessage(content?: string | null): string {
  const cleaned = stripTechnicalContent(content, 100);
  if (!cleaned) {
    return "J'analyse la demande.";
  }

  const mapped = mapEnglishActionToFrench(cleaned);
  if (mapped) {
    return mapped;
  }

  const lower = cleaned.toLowerCase();
  if (lower.includes('page')) return "J'ouvre la page.";
  if (lower.includes('resultat')) return 'Je compare les resultats.';
  if (lower.includes('verification') || lower.includes('verifie')) return 'Je verifie les informations.';
  if (lower.includes('suite')) return 'Je prepare la suite.';

  return 'Je prepare la suite.';
}

export function buildFinalizingMessage(): string {
  return 'Je finalise.';
}

export function buildCompletedMessage(): string {
  return "C'est terminé.";
}

export function buildSummaryMessage(taskText?: string | null, finalContent?: string | null): string {
  const task = stripTechnicalContent(taskText, 80);
  const result = stripTechnicalContent(finalContent, 140);

  if (!task && !result) {
    return 'Voici le resultat. La demande est traitee.';
  }

  const sentences: string[] = [];

  if (task) {
    sentences.push(toSentence(`Demande comprise : ${shorten(task, 70)}`));
  }

  sentences.push(toSentence('La demande est traitee'));

  if (result) {
    sentences.push(toSentence(`Resultat : ${shorten(result, 100)}`));
  } else {
    sentences.push(toSentence('Le resultat est disponible'));
  }

  return sentences.slice(0, 3).join(' ');
}

export function buildNextActionMessage(finalContent?: string | null): string {
  const result = stripTechnicalContent(finalContent, 120).toLowerCase();

  if (result.includes('lien') || result.includes('url')) {
    return 'Prochaine etape : ouvrir le lien.';
  }

  if (result.includes('choix') || result.includes('option')) {
    return 'Prochaine etape : valider ce choix.';
  }

  return 'Prochaine etape : verifier le resultat.';
}
