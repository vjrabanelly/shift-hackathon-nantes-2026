/**
 * Dictionnaire des acteurs politiques français.
 * Utilisé par le rules-engine pour scorer la portée politique (0-4).
 */

// Partis politiques français (noms + abréviations)
export const POLITICAL_PARTIES = new Set([
  // Gauche
  'lfi', 'la france insoumise', 'france insoumise', 'npa', 'nouveau parti anticapitaliste',
  'pcf', 'parti communiste', 'eelv', 'europe écologie', 'les verts',
  'ps', 'parti socialiste', 'place publique', 'génération.s', 'générations',
  // Centre
  'renaissance', 'lrem', 'en marche', 'la république en marche', 'modem',
  'mouvement démocrate', 'horizons', 'edouard philippe',
  // Droite
  'lr', 'les républicains', 'républicains', 'ump',
  // Extrême droite
  'rn', 'rassemblement national', 'front national', 'fn', 'reconquête', 'reconquete',
  'zemmour', 'patriotes', 'les patriotes',
  // Autres
  'lutte ouvrière', 'lutte ouvriere', 'debout la france', 'dlf',
]);

// Figures politiques (noms de famille, identifiables sans ambiguïté)
export const POLITICAL_FIGURES = new Set([
  // Exécutif
  'macron', 'emmanuel macron', 'borne', 'attal', 'bayrou',
  // Gauche
  'mélenchon', 'melenchon', 'ruffin', 'panot', 'autain', 'roussel',
  'jadot', 'tondelier', 'hidalgo', 'glucksmann',
  // Droite
  'retailleau', 'wauquiez', 'ciotti', 'pécresse', 'sarkozy',
  // Extrême droite
  'le pen', 'marine le pen', 'bardella', 'zemmour', 'maréchal',
  // Autres
  'philippe', 'edouard philippe', 'dupont-moretti', 'darmanin',
]);

// Institutions publiques
export const INSTITUTIONS = new Set([
  'assemblée nationale', 'assemblee nationale', 'sénat', 'senat',
  'élysée', 'elysee', 'matignon', 'gouvernement',
  'conseil constitutionnel', 'conseil d\'état', 'conseil detat',
  'parlement', 'parlement européen', 'commission européenne',
  'onu', 'otan', 'nato', 'g7', 'g20',
  'préfecture', 'prefecture', 'mairie', 'conseil municipal',
  'conseil régional', 'conseil départemental',
  'cour des comptes', 'défenseur des droits',
  'cnil', 'arcom', 'autorité de la concurrence',
]);

// Termes d'action politique / militante
export const ACTIVISM_TERMS = new Set([
  'manifestation', 'manif', 'grève', 'greve', 'blocage',
  'pétition', 'petition', 'mobilisation', 'rassemblement',
  'boycott', 'boycotter', 'occupation', 'sit-in',
  'désobéissance civile', 'desobeissance civile',
  'collectif', 'mouvement social', 'lutte',
  'militant', 'militante', 'militants', 'militantes',
  'activiste', 'activistes', 'engagement citoyen',
]);

// Termes courts qui nécessitent un match mot entier (word boundary)
const SHORT_TERMS = new Set(['lfi', 'npa', 'pcf', 'eelv', 'ps', 'lr', 'rn', 'fn', 'dlf']);

/**
 * Vérifie si un terme est présent dans le texte.
 * Pour les termes courts (≤3 chars ou dans SHORT_TERMS), utilise un match mot entier.
 */
function termPresent(text: string, term: string): boolean {
  if (term.length <= 3 || SHORT_TERMS.has(term)) {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(text);
  }
  return text.includes(term);
}

/**
 * Vérifie la présence d'acteurs politiques dans un texte normalisé (lowercase).
 * Retourne les matches trouvés par catégorie.
 */
export function detectPoliticalActors(text: string): {
  parties: string[];
  figures: string[];
  institutions: string[];
  activismTerms: string[];
} {
  const lower = text.toLowerCase();
  const parties = [...POLITICAL_PARTIES].filter(p => termPresent(lower, p));
  const figures = [...POLITICAL_FIGURES].filter(f => termPresent(lower, f));
  const institutions = [...INSTITUTIONS].filter(i => termPresent(lower, i));
  const activismTerms = [...ACTIVISM_TERMS].filter(a => termPresent(lower, a));
  return { parties, figures, institutions, activismTerms };
}
