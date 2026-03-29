/**
 * Système extensible de correction des topics LLM.
 * Remplace le hack ad hoc boardgame dans pipeline.ts.
 *
 * Chaque règle détecte un contexte (signaux dans username+text)
 * et applique des corrections de topics.
 */

export interface TopicCorrectionRule {
  name: string;
  signals: string[];
  replacements: Record<string, string>;  // topic_source → topic_corrigé
  addTopics?: string[];                  // topics à ajouter si absents
}

export const TOPIC_CORRECTION_RULES: TopicCorrectionRule[] = [
  {
    name: 'boardgame_not_sport',
    signals: [
      'boardgame', 'board_game', 'board game', 'boardgamegeek',
      'jeux de société', 'jeux de societe', 'jeu de société', 'jeu de societe',
      'juegos de mesa', 'tabletop', 'tabletopgaming',
      'boardgaming', 'brettspiel', 'giochi da tavolo',
      'ludique', 'ludiques', 'ludo', 'ludomaublanc',
      'playing card', 'playingcard', 'card game', 'cardgame',
      'dice', 'meeple', 'jeu de plateau', 'game sanctuary',
      'lucky duck', 'days of wonder', 'daysofwonder',
      'gigamic', 'asmodee', 'repos production',
      'games.andplay', 'gamesandplay', 'plays solo', 'playssolo',
      'czech games', 'czech_games',
    ],
    replacements: { sport: 'divertissement' },
  },
  {
    name: 'food_adds_lifestyle',
    signals: [
      'food', 'cuisine', 'recette', 'recipe', 'chef', 'restaurant',
      'gastronomie', 'gastronomique', 'fork', 'eat', 'foodie', 'brunch',
      'boulangerie', 'pâtisserie', 'patisserie',
    ],
    replacements: {},
    addTopics: ['lifestyle'],
  },
  {
    name: 'media_account_adds_actualite',
    signals: [
      'france24', 'franceinfo', 'bfmtv', 'lci', 'lemonde', 'le_monde',
      'lefigaro', 'le_figaro', 'liberation', 'libération', 'mediapart',
      'brut', 'hugodecrypte', 'konbini', 'loopsider',
    ],
    replacements: {},
    addTopics: ['actualite'],
  },
  {
    name: 'luxury_fashion_is_beaute',
    signals: [
      'dior', 'chanel', 'gucci', 'vuitton', 'hermès', 'hermes',
      'balenciaga', 'prada', 'versace', 'ysl', 'saint laurent',
      'valentino', 'burberry', 'fendi', 'givenchy',
    ],
    replacements: {},
    addTopics: ['beaute'],
  },
];

/**
 * Applique toutes les règles de correction sur les topics LLM.
 * Mutates main_topics et secondary_topics in place.
 */
export function applyTopicCorrections(
  mainTopics: string[],
  secondaryTopics: string[],
  username: string,
  normalizedText: string,
): void {
  const ctx = `${username} ${normalizedText}`.toLowerCase();

  for (const rule of TOPIC_CORRECTION_RULES) {
    const matches = rule.signals.some(sig => ctx.includes(sig));
    if (!matches) continue;

    // Apply replacements
    const replace = (topics: string[]) =>
      topics.map(t => rule.replacements[t] ?? t);
    mainTopics.splice(0, mainTopics.length, ...replace(mainTopics));
    secondaryTopics.splice(0, secondaryTopics.length, ...replace(secondaryTopics));

    // Add missing topics
    if (rule.addTopics) {
      for (const topic of rule.addTopics) {
        if (!mainTopics.includes(topic) && !secondaryTopics.includes(topic)) {
          secondaryTopics.push(topic);
        }
      }
    }
  }
}
