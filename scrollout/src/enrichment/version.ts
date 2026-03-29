/**
 * Versionnage des règles d'enrichissement et de la taxonomie.
 *
 * Politique de versionnage :
 * - MAJOR (X.0.0) : changement de taxonomie (ajout/suppression domaine ou thème)
 * - MINOR (0.X.0) : ajout dictionnaire, nouveaux sujets précis, nouveau signal
 * - PATCH (0.0.X) : ajustement seuils, ajout mots-clés, correction prompt LLM
 *
 * Ce fichier est la source de vérité. La version est persistée dans PostEnriched.version
 * pour permettre la traçabilité et la comparaison entre enrichissements.
 */

/** Version courante des règles de scoring et dictionnaires */
export const SCORING_RULES_VERSION = '1.0.0';

/** Version courante de la taxonomie (domaines, thèmes, sujets) */
export const TAXONOMY_VERSION = '1.0.0';

/** Version courante du prompt LLM */
export const PROMPT_VERSION = '1.0.0';

/**
 * Version composite utilisée dans PostEnriched.version.
 * Format: "rules@X.X.X+taxonomy@X.X.X+prompt@X.X.X"
 */
export function getEnrichmentVersion(): string {
  return `rules@${SCORING_RULES_VERSION}+taxonomy@${TAXONOMY_VERSION}+prompt@${PROMPT_VERSION}`;
}

/**
 * Changelog des versions.
 * Permet de documenter les changements et leur impact sur les scores.
 */
export const VERSION_CHANGELOG: Array<{
  version: string;
  date: string;
  type: 'rules' | 'taxonomy' | 'prompt';
  description: string;
}> = [
  {
    version: '1.0.0',
    date: '2026-03-28',
    type: 'taxonomy',
    description: 'Taxonomie initiale : 7 domaines, 24 thèmes, ~150 sujets, sujets précis politique FR',
  },
  {
    version: '1.0.0',
    date: '2026-03-28',
    type: 'rules',
    description: 'Rules engine v1 : political-actors, militant-hashtags, conflict-vocabulary, political-axes, media-category, political-accounts',
  },
  {
    version: '1.0.0',
    date: '2026-03-28',
    type: 'prompt',
    description: 'Prompt LLM v1 : enrichissement 27 champs, scoring politique 0-4, polarisation 0-1, 15 narratifs',
  },
];
