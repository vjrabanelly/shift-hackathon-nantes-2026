/**
 * Dictionnaire des axes politiques — Political Compass FR.
 * 4 axes bipolaires, chaque pôle a ses propres marqueurs textuels.
 * Scoring par axe : -1 (pôle gauche/progressiste/libertaire/anti-système)
 *                    0 (neutre)
 *                   +1 (pôle droite/conservateur/autoritaire/institutionnel)
 */

// ── Axe 1 : Économique ──────────────────────────────────────────────
// gauche économique (-1) ↔ droite économique (+1)

export const ECONOMIC_LEFT = [
  // Redistribution, état, services publics
  'redistribution', 'justice sociale', 'service public', 'services publics',
  'nationalisation', 'nationaliser', 'bien commun', 'biens communs',
  'état providence', 'etat providence', 'protection sociale',
  'smic', 'augmentation des salaires', 'hausse des salaires',
  'taxer les riches', 'impôt sur la fortune', 'isf', 'egalité salariale',
  'anticapitalisme', 'anticapitaliste', 'exploitation',
  'précarité', 'precarite', 'travailleurs', 'classe ouvrière', 'classe ouvriere',
  'gratuité', 'gratuite', 'droit au logement', 'retraite à 60',
  'sécurité sociale', 'securite sociale', 'cotisations',
  'pouvoir d\'achat', 'pouvoir d achat', 'vie chère', 'vie chere',
  'lutte des classes', 'prolétariat', 'proletariat',
  'coopérative', 'cooperative', 'mutualisme', 'économie solidaire',
];

export const ECONOMIC_RIGHT = [
  // Marché, entrepreneuriat, libéralisme
  'libre entreprise', 'entrepreneuriat', 'compétitivité', 'competitivite',
  'libéralisme', 'liberalisme', 'libéral', 'liberal',
  'privatisation', 'privatiser', 'dérégulation', 'deregulation',
  'baisse des impôts', 'baisser les impôts', 'trop d\'impôts',
  'charges sociales', 'alléger les charges', 'simplification',
  'croissance', 'pib', 'attractivité', 'attractivite',
  'start-up nation', 'startup', 'innovation',
  'mérite', 'merite', 'méritocratie', 'meritocratie',
  'dette publique', 'déficit', 'deficit', 'rigueur budgétaire',
  'réforme des retraites', 'reforme des retraites', 'travailler plus',
  'flexibilité', 'flexibilite', 'marché du travail', 'marche du travail',
  'auto-entrepreneur', 'initiative privée', 'libre échange',
];

// ── Axe 2 : Sociétal ────────────────────────────────────────────────
// progressiste (-1) ↔ conservateur (+1)

export const SOCIETAL_PROGRESSIVE = [
  // Droits individuels, ouverture, modernité
  'mariage pour tous', 'mariage homosexuel', 'homoparentalité',
  'droits lgbt', 'lgbtqia', 'pride', 'fierté', 'fierte',
  'transidentité', 'transidentite', 'non-binaire',
  'pma pour toutes', 'pma', 'gpa', 'ivg', 'droit à l\'avortement',
  'féminisme', 'feminisme', 'féministe', 'feministe',
  'égalité femmes hommes', 'egalite femmes hommes', 'parité', 'parite',
  'antiracisme', 'antiraciste', 'décolonial', 'decolonial',
  'intersectionnalité', 'intersectionnalite',
  'inclusion', 'inclusif', 'inclusive', 'diversité', 'diversite',
  'multiculturalisme', 'vivre ensemble',
  'dépénalisation', 'depenalisation', 'cannabis', 'légalisation',
  'laïcité ouverte', 'laicite ouverte',
  'euthanasie', 'fin de vie', 'droit de mourir',
  'écriture inclusive', 'ecriture inclusive',
];

export const SOCIETAL_CONSERVATIVE = [
  // Tradition, ordre moral, valeurs
  'valeurs traditionnelles', 'tradition', 'traditions',
  'famille traditionnelle', 'cellule familiale',
  'natalité', 'natalite', 'politique nataliste',
  'manif pour tous', 'manifpourtous',
  'anti-ivg', 'pro-vie', 'provie',
  'identité nationale', 'identite nationale', 'identité française',
  'racines', 'héritage', 'heritage', 'patrimoine culturel',
  'civilisation', 'civilisationnel', 'judéo-chrétien', 'chrétienté',
  'ordre moral', 'déclin moral', 'declin moral',
  'décadence', 'decadence', 'dégénérescence',
  'communautarisme', 'communautariste',
  'wokisme', 'woke', 'anti-woke', 'cancel culture',
  'théorie du genre', 'theorie du genre', 'idéologie du genre',
  'grand remplacement', 'remigration', 'assimilation',
  'autorité parentale', 'autorite parentale',
];

// ── Axe 3 : Autorité ────────────────────────────────────────────────
// libertaire (-1) ↔ autoritaire (+1)

export const LIBERTARIAN = [
  // Libertés civiles, vie privée, autonomie
  'liberté d\'expression', 'liberte d expression', 'liberté de la presse',
  'libertés individuelles', 'libertes individuelles',
  'vie privée', 'vie privee', 'surveillance de masse',
  'anti-surveillance', 'big brother', 'état policier', 'etat policier',
  'désobéissance civile', 'desobeissance civile',
  'droit de manifester', 'liberté de réunion',
  'censure', 'anti-censure', 'liberté d\'opinion',
  'autodétermination', 'autodetermination', 'autonomie',
  'décentralisation', 'decentralisation',
  'anarchisme', 'anarchiste', 'autogestion',
  'libertaire', 'libertarien',
  'données personnelles', 'donnees personnelles', 'rgpd', 'cnil',
  'lanceur d\'alerte', 'lanceur d alerte', 'whistleblower',
];

export const AUTHORITARIAN = [
  // Contrôle, sécurité, ordre
  'ordre', 'ordre public', 'rétablir l\'ordre', 'retablir l ordre',
  'autorité', 'autorite', 'autorité de l\'état', 'fermeté', 'fermete',
  'tolérance zéro', 'tolerance zero', 'main forte',
  'sécurité', 'securite', 'sécuritaire', 'securitaire',
  'police', 'forces de l\'ordre', 'forces de l ordre', 'gendarmerie',
  'vidéosurveillance', 'videosurveillance', 'caméras',
  'peines plancher', 'prison', 'incarcération', 'incarceration',
  'expulsion', 'expulser', 'oqtf', 'reconduite à la frontière',
  'déchéance de nationalité', 'decheance de nationalite',
  'état d\'urgence', 'etat d urgence', 'couvre-feu',
  'contrôle aux frontières', 'controle aux frontieres',
  'interdiction', 'interdire', 'réprimer', 'reprimer',
  'souveraineté', 'souverainete', 'souverainisme',
  'armée', 'armee', 'service militaire', 'service national',
];

// ── Axe 4 : Rapport au système ───────────────────────────────────────
// anti-système (-1) ↔ institutionnel (+1)

export const ANTI_SYSTEM = [
  // Contestation, rupture, défiance
  'système', 'systeme', 'anti-système', 'anti-systeme', 'antisystème',
  'oligarchie', 'ploutocratie', 'les élites', 'les elites',
  'caste', 'les puissants', 'les corrompus', 'corruption',
  'ils nous mentent', 'on nous ment', 'médias mainstream', 'medias mainstream',
  'désinformation', 'desinformation', 'propagande',
  'révolution', 'revolution', 'insurrection', 'soulèvement',
  'dégagisme', 'degagisme', 'tous pourris', 'bande de',
  'démocratie directe', 'democratie directe', 'ric', 'référendum',
  'sixième république', 'sixieme republique',
  'constituante', 'assemblée constituante',
  'abstention', 'vote blanc', 'boycott électoral',
  'dégage', 'degage', 'qu\'ils partent', 'dehors',
  'complot', 'conspiration', 'face cachée',
];

export const INSTITUTIONAL = [
  // Réforme dans le cadre, confiance institutions
  'réforme', 'reforme', 'réformer', 'reformer',
  'dialogue social', 'concertation', 'négociation', 'negociation',
  'consensus', 'compromis', 'modération', 'moderation',
  'institutions', 'institutionnel', 'républicain', 'republicain',
  'état de droit', 'etat de droit', 'constitution',
  'démocratie représentative', 'democratie representative',
  'élections', 'elections', 'vote', 'voter', 'bulletin',
  'parlement', 'parlementaire', 'débat parlementaire',
  'loi', 'projet de loi', 'proposition de loi', 'amendement',
  'commission', 'commission parlementaire', 'rapport',
  'expertise', 'expert', 'technocratie',
  'europe', 'construction européenne', 'construction europeenne',
  'multilatéralisme', 'multilateralisme', 'coopération internationale',
  'stabilité', 'stabilite', 'continuité', 'continuite',
];

// ── Types ────────────────────────────────────────────────────────────

export interface AxisScore {
  economic: number;   // -1 (gauche) → +1 (droite)
  societal: number;   // -1 (progressiste) → +1 (conservateur)
  authority: number;  // -1 (libertaire) → +1 (autoritaire)
  system: number;     // -1 (anti-système) → +1 (institutionnel)
}

interface AxisConfig {
  name: keyof AxisScore;
  negative: string[]; // pôle -1
  positive: string[]; // pôle +1
}

const AXES: AxisConfig[] = [
  { name: 'economic', negative: ECONOMIC_LEFT, positive: ECONOMIC_RIGHT },
  { name: 'societal', negative: SOCIETAL_PROGRESSIVE, positive: SOCIETAL_CONSERVATIVE },
  { name: 'authority', negative: LIBERTARIAN, positive: AUTHORITARIAN },
  { name: 'system', negative: ANTI_SYSTEM, positive: INSTITUTIONAL },
];

/**
 * Analyse un texte sur les 4 axes politiques.
 * Retourne un score [-1, +1] par axe et les termes matchés.
 */
export function detectPoliticalAxes(text: string): {
  scores: AxisScore;
  matches: Record<string, { negative: string[]; positive: string[] }>;
  dominant: string | null; // axe le plus marqué, ou null si neutre
} {
  const lower = text.toLowerCase();
  const scores: AxisScore = { economic: 0, societal: 0, authority: 0, system: 0 };
  const matches: Record<string, { negative: string[]; positive: string[] }> = {};

  for (const axis of AXES) {
    const negMatches = axis.negative.filter(t => lower.includes(t));
    const posMatches = axis.positive.filter(t => lower.includes(t));
    matches[axis.name] = { negative: negMatches, positive: posMatches };

    const negWeight = Math.min(negMatches.length, 5);
    const posWeight = Math.min(posMatches.length, 5);
    const total = negWeight + posWeight;

    if (total > 0) {
      // Score = direction pondérée, normalisé [-1, +1]
      scores[axis.name] = Math.round(((posWeight - negWeight) / total) * 100) / 100;
    }
  }

  // Axe dominant = celui avec le plus de matches total
  let maxMatches = 0;
  let dominant: string | null = null;
  for (const axis of AXES) {
    const total = matches[axis.name].negative.length + matches[axis.name].positive.length;
    if (total > maxMatches) {
      maxMatches = total;
      dominant = axis.name;
    }
  }
  if (maxMatches < 2) dominant = null; // pas assez de signal

  return { scores, matches, dominant };
}
