/**
 * Classification du type et de la qualité du média.
 * Catégorie : divertissement | information | opinion | intox | pub | education
 * Qualité : factuel | émotionnel | sensationnel | trompeur | neutre
 */

// ── Marqueurs de catégorie ──────────────────────────────────────────

const ENTERTAINMENT_MARKERS = [
  'mdr', 'lol', 'ptdr', 'xd', '😂', '🤣', 'mort de rire',
  'funny', 'drôle', 'drole', 'humour', 'blague', 'sketch', 'prank',
  'meme', 'memes', 'trend', 'trending', 'viral', 'challenge',
  'dance', 'danse', 'musique', 'music', 'clip', 'concert',
  'série', 'serie', 'film', 'cinéma', 'cinema', 'netflix', 'disney',
  'gaming', 'gamer', 'jeu vidéo', 'jeu video', 'esport',
  'recette', 'cuisine', 'food', 'foodporn', 'restaurant',
  'voyage', 'travel', 'vacances', 'plage', 'sunset',
  'mode', 'fashion', 'outfit', 'ootd', 'look', 'haul',
  'makeup', 'maquillage', 'skincare', 'routine', 'tuto beauté',
  'fitness', 'workout', 'gym', 'musculation', 'yoga',
  'cute', 'adorable', 'aww', 'pet', 'chien', 'chat', 'chaton',
];

const INFORMATION_MARKERS = [
  'selon', 'd\'après', 'd apres', 'source', 'sources',
  'rapport', 'étude', 'etude', 'enquête', 'enquete',
  'statistiques', 'chiffres', 'données', 'donnees',
  'communiqué', 'communique', 'officiel', 'officiellement',
  'breaking', 'alerte info', 'dernière heure', 'derniere heure',
  'flash info', 'info', 'actu', 'actualité', 'actualite',
  'journal', 'presse', 'reportage', 'investigation',
  'bfm', 'cnews', 'france info', 'le monde', 'libération', 'liberation',
  'figaro', 'mediapart', 'reuters', 'afp', 'ap news',
  'fact-check', 'factcheck', 'vérification', 'verification',
  'déclaration', 'declaration', 'annonce', 'annoncé', 'annonce',
  'bilan', 'résultats', 'resultats',
];

const OPINION_MARKERS = [
  'je pense', 'je crois', 'à mon avis', 'a mon avis', 'selon moi',
  'mon opinion', 'mon point de vue', 'personnellement',
  'je suis convaincu', 'il faut que', 'on devrait',
  'tribune', 'édito', 'edito', 'éditorial', 'editorial',
  'chronique', 'billet', 'coup de gueule',
  'il est temps', 'il est urgent', 'il faut agir',
  'je dénonce', 'je denonce', 'je m\'oppose', 'je m oppose',
  'mon analyse', 'à mes yeux', 'a mes yeux',
  'thread', '🧵', 'unpopular opinion', 'hot take',
  'débat', 'debat', 'polémique', 'polemique', 'controverse',
];

const INTOX_MARKERS = [
  'on ne vous dit pas', 'on nous cache', 'la vérité cachée', 'la verite cachee',
  'ce que les médias', 'ce que les medias', 'les médias mentent', 'les medias mentent',
  'révélation', 'revelation', 'exclusif', 'choquant',
  'ils ne veulent pas que vous', 'on vous ment',
  'complot', 'conspiration', 'planifié', 'planifie',
  'nouvel ordre mondial', 'nwo', 'great reset',
  'big pharma', 'big tech', 'deep state', 'état profond',
  'ouvrez les yeux', 'réveillez-vous', 'reveillez-vous',
  'preuve irréfutable', 'preuves accablantes',
  'censuré', 'censure', 'supprimé par', 'interdit de diffusion',
  'fausse flag', 'false flag', 'mise en scène', 'mise en scene',
  'officiellement interdit', 'ils ont peur',
];

const PUB_MARKERS = [
  'sponsorisé', 'sponsorise', 'sponsored', 'ad', 'partenariat',
  'collaboration', 'collab', '#pub', '#ad', '#sponsored',
  'lien en bio', 'link in bio', 'code promo', 'réduction', 'reduction',
  '-20%', '-30%', '-50%', 'offre limitée', 'offre limitee',
  'livraison gratuite', 'achetez', 'acheter maintenant',
  'profitez', 'bon plan', 'deal', 'promo',
  'affiliation', 'affilié', 'marque', 'produit offert',
  'unboxing', 'test produit', 'review', 'avis',
];

const EDUCATION_MARKERS = [
  'saviez-vous', 'le saviez-vous', 'did you know',
  'explication', 'expliqué', 'explique', 'comment fonctionne',
  'tutoriel', 'tuto', 'guide', 'apprendre', 'cours',
  'formation', 'masterclass', 'conférence', 'conference', 'ted',
  'science', 'scientifique', 'recherche', 'découverte', 'decouverte',
  'histoire', 'historique', 'documentaire',
  'vulgarisation', 'pédagogie', 'pedagogie',
  'définition', 'definition', 'concept', 'théorie', 'theorie',
  'astuce', 'conseil', 'tips', 'hack', 'lifehack',
];

// ── Marqueurs de qualité ────────────────────────────────────────────

const FACTUAL_MARKERS = [
  'selon une étude', 'selon une etude', 'd\'après les chiffres',
  'source :', 'sources :', 'référence', 'reference',
  'rapport officiel', 'données publiques', 'donnees publiques',
  'insee', 'eurostat', 'oms', 'who',
  'peer reviewed', 'revue scientifique', 'méta-analyse',
  'fact-check', 'vérifié', 'verifie',
];

const EMOTIONAL_MARKERS = [
  '😭', '💔', '🥺', '😡', '🤬', '❤️', '🙏',
  'bouleversant', 'émouvant', 'emouvant', 'touchant',
  'larmes', 'pleurer', 'cœur brisé', 'coeur brise',
  'magnifique', 'merveilleux', 'incroyable',
  'terrible', 'horrible', 'atroce', 'tragique', 'drame',
];

const SENSATIONAL_MARKERS = [
  '🔥', '💣', '⚡', '‼️', '❗',
  'incroyable', 'hallucinant', 'fou', 'dingue', 'ouf',
  'vous n\'allez pas croire', 'vous n allez pas croire',
  'choc', 'choquant', 'stupéfiant', 'stupefiant',
  'énorme', 'enorme', 'scandale', 'bombe', 'explosion',
  'jamais vu', 'sans précédent', 'sans precedent',
  'clickbait', 'putaclic',
];

const MISLEADING_MARKERS = [
  ...INTOX_MARKERS.slice(0, 10),
  'fake news', 'infox', 'désinformation',
  'manipulé', 'manipule', 'truqué', 'truque',
  'hors contexte', 'sorti de son contexte',
  'date ancienne', 'photo ancienne', 'recycled',
];

interface CategoryConfig {
  name: string;
  markers: string[];
  weight: number;
}

const CATEGORIES: CategoryConfig[] = [
  { name: 'intox', markers: INTOX_MARKERS, weight: 1.3 },
  { name: 'pub', markers: PUB_MARKERS, weight: 1.2 },
  { name: 'information', markers: INFORMATION_MARKERS, weight: 1.0 },
  { name: 'opinion', markers: OPINION_MARKERS, weight: 1.0 },
  { name: 'education', markers: EDUCATION_MARKERS, weight: 1.0 },
  { name: 'divertissement', markers: ENTERTAINMENT_MARKERS, weight: 0.8 },
];

const QUALITIES: CategoryConfig[] = [
  { name: 'trompeur', markers: MISLEADING_MARKERS, weight: 1.3 },
  { name: 'sensationnel', markers: SENSATIONAL_MARKERS, weight: 1.1 },
  { name: 'émotionnel', markers: EMOTIONAL_MARKERS, weight: 1.0 },
  { name: 'factuel', markers: FACTUAL_MARKERS, weight: 1.0 },
];

function scoreCategory(text: string, configs: CategoryConfig[]): { name: string; score: number; matches: string[] } | null {
  let best: { name: string; score: number; matches: string[] } | null = null;

  for (const cat of configs) {
    const matches = cat.markers.filter(m => text.includes(m));
    const score = matches.length * cat.weight;
    if (score > 0 && (!best || score > best.score)) {
      best = { name: cat.name, score, matches };
    }
  }

  return best;
}

/**
 * Classifie un post par type de média et qualité du contenu.
 */
export function classifyMedia(text: string, isSponsored: boolean): {
  category: string;
  quality: string;
  categoryMatches: string[];
  qualityMatches: string[];
} {
  const lower = text.toLowerCase();

  // Si sponsorisé, c'est de la pub
  if (isSponsored) {
    const quality = scoreCategory(lower, QUALITIES);
    return {
      category: 'pub',
      quality: quality?.name || 'neutre',
      categoryMatches: ['sponsored'],
      qualityMatches: quality?.matches || [],
    };
  }

  const cat = scoreCategory(lower, CATEGORIES);
  const qual = scoreCategory(lower, QUALITIES);

  return {
    category: cat?.name || '',
    quality: qual?.name || 'neutre',
    categoryMatches: cat?.matches || [],
    qualityMatches: qual?.matches || [],
  };
}
