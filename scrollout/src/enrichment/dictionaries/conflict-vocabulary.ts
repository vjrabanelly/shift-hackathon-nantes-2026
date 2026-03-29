/**
 * Dictionnaire du vocabulaire de conflit et de polarisation.
 * Utilisé pour scorer la polarisation (0-1).
 */

// Vocabulaire d'indignation / émotion forte
export const INDIGNATION_TERMS = [
  'scandale', 'scandaleux', 'honteux', 'honte', 'inadmissible', 'inacceptable',
  'intolérable', 'intolerable', 'révoltant', 'revoltant', 'dégueulasse', 'degueulasse',
  'ignoble', 'abject', 'écœurant', 'ecoeurant', 'insupportable',
  'c\'est la honte', 'on en a marre', 'ras le bol', 'ras-le-bol',
  'y en a assez', 'trop c\'est trop', 'jusqu\'à quand', 'jusqua quand',
  'on se fout de nous', 'on nous prend pour des cons',
];

// Vocabulaire d'opposition binaire (nous vs eux)
export const BINARY_OPPOSITION = [
  'les élites', 'les elites', 'le système', 'le systeme', 'la caste',
  'les puissants', 'les riches', 'les nantis', 'le peuple', 'les gens d\'en haut',
  'eux contre nous', 'nous contre eux', 'les vrais français', 'les vrais francais',
  'la france d\'en bas', 'ces gens-là', 'ces gens la',
  'les mondialistes', 'les bien-pensants', 'la pensée unique', 'la bienpensance',
  'le wokisme', 'woke', 'les wokistes', 'la gauche caviar',
  'les bobos', 'la bourgeoisie',
  'les islamistes', 'les intégristes', 'les collabos',
  'les traîtres', 'les traitres', 'les vendus',
];

// Vocabulaire de conflit / guerre
export const CONFLICT_TERMS = [
  'guerre', 'combat', 'combattre', 'ennemi', 'ennemis', 'adversaire',
  'attaque', 'attaquer', 'détruire', 'destruction', 'envahir', 'invasion',
  'résistance', 'resistance', 'résister', 'se battre', 'se soulever',
  'écraser', 'anéantir', 'éliminer', 'éradiquer', 'purge',
  'trahison', 'complot', 'conspiration', 'manipulation',
];

// Cadrage moral absolu (bien/mal sans nuance)
export const MORAL_ABSOLUTE = [
  'le mal absolu', 'le bien contre le mal', 'c\'est criminel',
  'génocide', 'genocide', 'crime contre l\'humanité', 'crime contre l humanite',
  'fascisme', 'fasciste', 'fascistes', 'nazisme', 'nazi', 'nazis',
  'dictature', 'totalitarisme', 'totalitaire',
  'barbarie', 'sauvagerie', 'monstrueux', 'monstrueuse',
  'diabolique', 'maléfique', 'pervers', 'perverse',
  'complice', 'complicité', 'responsable de morts',
  'sang sur les mains',
];

// Vocabulaire de simplification causale
export const CAUSAL_SIMPLIFICATION = [
  'c\'est à cause de', 'c est a cause de', 'c\'est la faute de', 'c est la faute de',
  'tout ça à cause', 'tout ca a cause', 'la seule raison', 'l\'unique responsable',
  'voilà la vérité', 'voila la verite', 'la vérité qu\'on vous cache',
  'on ne vous dit pas', 'ce qu\'ils ne veulent pas', 'ils ne veulent pas que vous',
  'ouvrez les yeux', 'réveillez-vous', 'reveillez-vous',
  'la preuve que', 'ça prouve bien que', 'ca prouve bien que',
];

// Désignation d'ennemi explicite
export const ENEMY_DESIGNATION = [
  'ennemi du peuple', 'ennemi de la france', 'ennemi de la nation',
  'danger pour la france', 'danger pour nos enfants', 'menace pour',
  'il faut les virer', 'dehors', 'dégagez', 'degagez',
  'à la porte', 'cassez-vous', 'hors de france',
  'on n\'en veut pas', 'on n en veut pas', 'on ne veut plus',
];

/**
 * Catégories de signaux avec leur poids dans le score de polarisation.
 */
export const POLARIZATION_CATEGORIES = [
  { name: 'indignation', terms: INDIGNATION_TERMS, weight: 0.15 },
  { name: 'binary_opposition', terms: BINARY_OPPOSITION, weight: 0.25 },
  { name: 'conflict', terms: CONFLICT_TERMS, weight: 0.20 },
  { name: 'moral_absolute', terms: MORAL_ABSOLUTE, weight: 0.20 },
  { name: 'causal_simplification', terms: CAUSAL_SIMPLIFICATION, weight: 0.10 },
  { name: 'enemy_designation', terms: ENEMY_DESIGNATION, weight: 0.10 },
] as const;

/**
 * Analyse un texte pour détecter les signaux de polarisation.
 * Retourne un score 0-1 et les signaux détectés.
 */
export function detectPolarization(text: string): {
  score: number;
  signals: {
    ingroupOutgroup: boolean;
    conflict: boolean;
    moralAbsolute: boolean;
    enemyDesignation: boolean;
  };
  matches: Record<string, string[]>;
} {
  const lower = text.toLowerCase();
  const matches: Record<string, string[]> = {};
  let totalScore = 0;

  for (const cat of POLARIZATION_CATEGORIES) {
    const found = cat.terms.filter(t => lower.includes(t));
    if (found.length > 0) {
      matches[cat.name] = found;
      // Score pondéré : 1 match = poids, 2+ = poids * 1.5 (plafonné)
      totalScore += cat.weight * Math.min(1 + (found.length - 1) * 0.5, 1.5);
    }
  }

  // Normaliser à [0, 1]
  const score = Math.min(totalScore, 1);

  return {
    score,
    signals: {
      ingroupOutgroup: (matches['binary_opposition']?.length ?? 0) > 0,
      conflict: (matches['conflict']?.length ?? 0) > 0,
      moralAbsolute: (matches['moral_absolute']?.length ?? 0) > 0,
      enemyDesignation: (matches['enemy_designation']?.length ?? 0) > 0,
    },
    matches,
  };
}
