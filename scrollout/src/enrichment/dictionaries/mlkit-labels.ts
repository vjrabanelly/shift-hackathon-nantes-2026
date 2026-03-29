/**
 * Mapping ML Kit vision labels → sujets taxonomie.
 * Les labels ML Kit sont en anglais (Google Vision API).
 * Chaque label est mappé vers 0+ subject IDs de la taxonomie.
 */

export interface MLKitLabel {
  text: string;
  confidence: number;
}

/**
 * Mapping label ML Kit → subject IDs taxonomie.
 * Seuls les labels discriminants sont mappés (pas "Person", "Sky", etc.).
 */
const LABEL_TO_SUBJECTS: Record<string, string[]> = {
  // ── Politique & Société ──
  'protest': ['vie_politique', 'militants_ecolo'],
  'demonstration': ['vie_politique', 'militants_ecolo'],
  'flag': ['relations_internationales'],
  'soldier': ['conflit_ukraine', 'conflit_israel_palestine'],
  'military': ['conflit_ukraine', 'conflit_israel_palestine'],
  'police': ['police'],
  'riot': ['violences_urbaines'],
  'election': ['elections'],
  'ballot': ['elections'],
  'courthouse': ['justice_penale'],
  'prison': ['justice_penale'],

  // ── Écologie ──
  'solar panel': ['transition_energetique'],
  'wind turbine': ['transition_energetique'],
  'nuclear': ['transition_energetique'],
  'pollution': ['pollution'],
  'wildfire': ['rechauffement_climatique'],
  'flood': ['catastrophe_naturelle'],
  'deforestation': ['biodiversite'],
  'glacier': ['rechauffement_climatique'],

  // ── Sport ──
  'soccer': ['football'],
  'football': ['football'],
  'stadium': ['football', 'jo_competition'],
  'basketball': ['autres_sports'],
  'tennis': ['autres_sports'],
  'boxing': ['sports_combat'],
  'martial arts': ['sports_combat'],
  'gym': ['fitness'],
  'running': ['fitness'],
  'olympic': ['jo_competition'],
  'medal': ['jo_competition'],

  // ── Culture & Divertissement ──
  'video game': ['gaming'],
  'controller': ['gaming'],
  'comic': ['anime_manga'],
  'anime': ['anime_manga'],
  'manga': ['anime_manga'],
  'movie': ['cinema'],
  'cinema': ['cinema'],
  'concert': ['musique'],
  'guitar': ['musique'],
  'piano': ['musique'],
  'microphone': ['musique', 'media_info'],
  'museum': ['art_patrimoine'],
  'painting': ['art_patrimoine'],
  'sculpture': ['art_patrimoine'],
  'graffiti': ['art_patrimoine'],
  'television': ['series_tv'],

  // ── Lifestyle & Beauté ──
  'food': ['food'],
  'meal': ['food'],
  'restaurant': ['food'],
  'cooking': ['food'],
  'dessert': ['food'],
  'coffee': ['food'],
  'sushi': ['food'],
  'pizza': ['food'],
  'makeup': ['maquillage'],
  'cosmetics': ['maquillage'],
  'skincare': ['skincare'],
  'hairstyle': ['coiffure'],
  'fashion': ['mode'],
  'dress': ['mode'],
  'jewelry': ['mode'],
  'travel': ['voyage'],
  'beach': ['voyage'],
  'mountain': ['voyage'],
  'hotel': ['voyage'],
  'airplane': ['voyage'],
  'interior design': ['deco_interieur'],
  'furniture': ['deco_interieur'],

  // ── Santé ──
  'hospital': ['hopital_soins'],
  'doctor': ['hopital_soins'],
  'nurse': ['hopital_soins'],
  'medicine': ['hopital_soins'],
  'vaccine': ['vaccination'],
  'syringe': ['vaccination'],

  // ── Technologie ──
  'robot': ['ia_generative'],
  'computer': ['tech_gadgets'],
  'smartphone': ['tech_gadgets'],
  'laptop': ['tech_gadgets'],
  'circuit board': ['tech_gadgets'],
  'cryptocurrency': ['crypto_trading'],

  // ── Religion ──
  'mosque': ['islam_france'],
  'church': ['christianisme'],
  'synagogue': ['antisemitisme'],
  'prayer': ['laicite'],

  // ── Business ──
  'chart': ['bourse_finance'],
  'stock market': ['bourse_finance'],
  'money': ['pouvoir_achat'],
  'banknote': ['pouvoir_achat'],
};

/**
 * Convertit les labels ML Kit en subject IDs de la taxonomie.
 * Retourne les sujets uniques, triés par confiance des labels.
 */
export function mapMLKitLabelsToSubjects(labels: MLKitLabel[]): {
  subjectIds: string[];
  labelDetails: { label: string; confidence: number; subjects: string[] }[];
} {
  const subjectSet = new Set<string>();
  const details: { label: string; confidence: number; subjects: string[] }[] = [];

  // Trier par confiance décroissante
  const sorted = [...labels].sort((a, b) => b.confidence - a.confidence);

  for (const label of sorted) {
    const key = label.text.toLowerCase();
    const subjects = LABEL_TO_SUBJECTS[key];
    if (subjects && subjects.length > 0) {
      for (const s of subjects) subjectSet.add(s);
      details.push({ label: label.text, confidence: label.confidence, subjects });
    }
  }

  return {
    subjectIds: Array.from(subjectSet),
    labelDetails: details,
  };
}

/**
 * Formate les labels ML Kit en texte pour injection dans normalizedText.
 * Format : [VISION_LABELS] protest (0.95), crowd (0.88), flag (0.72)
 */
export function formatMLKitLabelsAsText(labels: MLKitLabel[], minConfidence = 0.5): string {
  const filtered = labels.filter(l => l.confidence >= minConfidence);
  if (filtered.length === 0) return '';

  const parts = filtered
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)
    .map(l => `${l.text} (${l.confidence.toFixed(2)})`);

  return `[VISION_LABELS] ${parts.join(', ')}`;
}
