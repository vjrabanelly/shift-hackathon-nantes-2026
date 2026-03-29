export type VoiceCommand =
  | 'continue'
  | 'ouvre'
  | 'compare'
  | 'repete'
  | 'annule'
  | 'reviens'
  | 'execute'
  | 'stop'
  | 'modify';

export type VoiceCommandRoute =
  | { type: 'action'; command: VoiceCommand; confirmation: string }
  | { type: 'fallback'; command: VoiceCommand; confirmation: string }
  | { type: 'ambiguous'; message: string }
  | { type: 'none' };

const COMMAND_ALIASES: Record<VoiceCommand, string[]> = {
  continue: ['continue', 'continuer'],
  ouvre: ['ouvre', 'ouvrir'],
  compare: ['compare', 'comparer'],
  repete: ['repete', 'repeter', 'repetez'],
  annule: ['annule', 'annuler'],
  reviens: ['reviens', 'revenir', 'retour'],
  execute: [
    'go',
    'fais-le',
    'fais le',
    'lance',
    'vas-y',
    'vas y',
    "c'est bon",
    'cest bon',
    'ok',
    'oui',
    'commence',
    'demarre',
  ],
  stop: ['stop', 'arrete', 'arreter', 'pause'],
  modify: ['change', 'changer', 'modifie', 'modifier'],
};

const POLITE_TRAILING_WORDS = new Set(['stp', 'svp', 'please', 'maintenant']);

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[!?.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMatchingCommands(tokens: string[]): VoiceCommand[] {
  return (Object.entries(COMMAND_ALIASES) as Array<[VoiceCommand, string[]]>)
    .filter(([, aliases]) => tokens.some(token => aliases.includes(token)))
    .map(([command]) => command);
}

export function routeVoiceCommand(input: string): VoiceCommandRoute {
  const normalized = normalizeText(input);
  if (!normalized) {
    return { type: 'none' };
  }

  const tokens = normalized.split(' ').filter(Boolean);
  const matchingCommands = getMatchingCommands(tokens);

  if (matchingCommands.length > 1) {
    return {
      type: 'ambiguous',
      message: "Commande vocale ambigue. J'utilise le texte normal a la place.",
    };
  }

  if (matchingCommands.length === 0) {
    return { type: 'none' };
  }

  const command = matchingCommands[0];
  const commandAliases = COMMAND_ALIASES[command];
  const firstToken = tokens[0];
  const trailingTokens = tokens.slice(1);

  const looksLikeShortCommand =
    commandAliases.includes(firstToken) &&
    trailingTokens.length <= 1 &&
    trailingTokens.every(token => POLITE_TRAILING_WORDS.has(token));

  if (!looksLikeShortCommand) {
    return { type: 'none' };
  }

  switch (command) {
    case 'annule':
      return { type: 'action', command, confirmation: "J'annule." };
    case 'repete':
      return { type: 'action', command, confirmation: 'Je repete.' };
    case 'reviens':
      return { type: 'action', command, confirmation: 'Je reviens.' };
    case 'continue':
      return { type: 'fallback', command, confirmation: 'Commande continue reconnue. Je la traite comme une demande.' };
    case 'ouvre':
      return { type: 'fallback', command, confirmation: 'Commande ouvre reconnue. Je la traite comme une demande.' };
    case 'compare':
      return { type: 'fallback', command, confirmation: 'Commande compare reconnue. Je la traite comme une demande.' };
    case 'execute':
      return { type: 'action', command, confirmation: 'Je lance.' };
    case 'stop':
      return { type: 'action', command, confirmation: "J'arrete." };
    case 'modify':
      return { type: 'action', command, confirmation: 'Que souhaitez-vous modifier ?' };
    default:
      return { type: 'none' };
  }
}
