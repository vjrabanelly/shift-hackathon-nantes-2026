/**
 * Dictionnaire des hashtags militants et politiques.
 * Normalisés en lowercase sans #.
 */

// Hashtags explicitement politiques
export const POLITICAL_HASHTAGS = new Set([
  // Gauche / social
  'justiceclimatique', 'justicesociale', 'urgenceclimatique', 'greve', 'grevegeneral',
  'onlacherien', 'reformedesretraites', 'retraites', 'convergencedesluttes',
  'anticapitalisme', 'anticapitaliste', 'melenchon', 'nupes', 'unionpopulaire',
  'nouveau front populaire', 'nfp',
  // Écologie militante
  'ecologie', 'derniere renovation', 'derniererenovation', 'extinctionrebellion',
  'stopepr', 'stopmegabassines', 'megabassines', 'zadiste', 'zad',
  'noussommeslanature', 'enr', 'transitionenergetique',
  // Droite / conservateur
  'manifpourtous', 'lamanifpourtous', 'tradwave', 'identitaire',
  'remigration', 'grandremplacment', 'reconquete', 'zemmour', 'bardella',
  'stopimmigration', 'francedabord', 'patriote', 'patriotes',
  // Féminisme / genre
  'metoo', 'metooinceste', 'balancetonporc', 'balancetontiktokeur',
  'feminisme', 'feministe', 'droitdesfemmes', 'ivg', 'egalite',
  'transphobie', 'lgbtqia', 'pride', 'fiertés',
  // Anti-système / complotisme léger
  'reveillezvous', 'ouvrezlesyeux', 'censure', 'libertedexpression',
  'dictature', 'dictatureSanitaire', 'passeportSanitaire', 'bigpharma',
  'greatreset', 'nwo', 'manipulation', 'desinformation',
  // Géopolitique
  'freepalestine', 'standwithpalestine', 'standwithisrael',
  'stopwar', 'nowar', 'ukraine', 'russie', 'gaza', 'genocide',
  // Causes sociales
  'logementpourtous', 'sdf', 'precarite', 'samu social',
  'discriminations', 'racisme', 'antiracisme', 'islamophobie',
  'antisemitisme', 'violencespolicières', 'violencespolicieres',
]);

// Hashtags sociétaux (score 1-2, pas 3-4)
export const SOCIETAL_HASHTAGS = new Set([
  'bienetre', 'santemental', 'santementale', 'burnout',
  'inclusion', 'diversite', 'handicap', 'accessibilite',
  'education', 'ecole', 'enseignement', 'numerique',
  'alimentation', 'bio', 'vegan', 'veganisme',
  'sante', 'hopital', 'soignants', 'desertmedical',
  'logement', 'immobilier', 'loyer', 'gentrification',
  'pouvoirdachat', 'inflation', 'salaire', 'smic',
]);

/**
 * Analyse les hashtags d'un post.
 * Retourne le niveau politique détecté et les hashtags matchés.
 */
export function analyzeHashtags(hashtags: string[]): {
  politicalHashtags: string[];
  societalHashtags: string[];
  politicalLevel: number; // 0=rien, 3=politique, 4=militant
} {
  const normalized = hashtags.map(h => h.toLowerCase().replace(/^#/, '').replace(/[_\s]/g, ''));

  const politicalHashtags = normalized.filter(h => POLITICAL_HASHTAGS.has(h));
  const societalHashtags = normalized.filter(h => SOCIETAL_HASHTAGS.has(h));

  let politicalLevel = 0;
  if (politicalHashtags.length >= 3) politicalLevel = 4;
  else if (politicalHashtags.length >= 1) politicalLevel = 3;
  else if (societalHashtags.length >= 2) politicalLevel = 2;
  else if (societalHashtags.length >= 1) politicalLevel = 1;

  return { politicalHashtags, societalHashtags, politicalLevel };
}
