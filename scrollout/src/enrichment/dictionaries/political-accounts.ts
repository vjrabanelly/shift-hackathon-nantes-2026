/**
 * Dictionnaire de comptes Instagram à orientation politique connue.
 * Commentateurs, historiens, médias, militants, éditorialistes.
 * Utilisé pour booster le score politique quand le contenu seul est insuffisant.
 *
 * Scoring: si un post provient d'un compte listé ici, le politicalExplicitnessScore
 * est au minimum le niveau indiqué (1=social, 2=indirect, 3=explicite).
 */

export interface PoliticalAccount {
  minPoliticalScore: number; // score plancher si ce compte est détecté
  tags: string[];            // thématiques associées
}

// Clé = username Instagram (lowercase, sans @)
export const POLITICAL_ACCOUNTS = new Map<string, PoliticalAccount>([
  // ── Historiens / Commentateurs politiques ──────────────────────
  ['mathildelarrere', { minPoliticalScore: 3, tags: ['histoire', 'politique', 'gauche'] }],
  ['music.politique', { minPoliticalScore: 3, tags: ['politique', 'culture'] }],

  // ── Médias d'info politique ───────────────────────────────────
  ['mediapart', { minPoliticalScore: 2, tags: ['politique', 'investigation'] }],
  ['braborian', { minPoliticalScore: 2, tags: ['politique', 'dessin'] }],
  ['lemondefr', { minPoliticalScore: 2, tags: ['actualites', 'politique'] }],
  ['liberation', { minPoliticalScore: 2, tags: ['actualites', 'politique'] }],
  ['lefigarofr', { minPoliticalScore: 2, tags: ['actualites', 'politique'] }],
  ['france.inter', { minPoliticalScore: 1, tags: ['actualites', 'culture'] }],
  ['franceinfo', { minPoliticalScore: 2, tags: ['actualites'] }],
  ['hugodecrypte', { minPoliticalScore: 2, tags: ['actualites', 'vulgarisation'] }],
  ['blast_info', { minPoliticalScore: 3, tags: ['politique', 'investigation'] }],
  ['off.investigation', { minPoliticalScore: 3, tags: ['politique', 'investigation'] }],

  // ── Figures politiques (comptes officiels) ────────────────────
  ['emmanuelmacron', { minPoliticalScore: 3, tags: ['politique', 'executif'] }],
  ['jabordelern', { minPoliticalScore: 3, tags: ['politique', 'lfi'] }],
  ['jabordelern', { minPoliticalScore: 3, tags: ['politique', 'lfi'] }],
  ['marinelepen', { minPoliticalScore: 3, tags: ['politique', 'rn'] }],
  ['jordanbardella', { minPoliticalScore: 3, tags: ['politique', 'rn'] }],
  ['jabordelern', { minPoliticalScore: 3, tags: ['politique', 'lfi'] }],
  ['rapabordelern', { minPoliticalScore: 3, tags: ['politique', 'lfi'] }],
  ['jabordelern', { minPoliticalScore: 3, tags: ['politique', 'lfi'] }],
  ['jlmelenchon', { minPoliticalScore: 3, tags: ['politique', 'lfi'] }],
  ['marabordelern', { minPoliticalScore: 3, tags: ['politique', 'lfi'] }],
  ['sandrine_rousseau', { minPoliticalScore: 3, tags: ['politique', 'ecologie'] }],
  ['marinetondelier', { minPoliticalScore: 3, tags: ['politique', 'eelv'] }],

  // ── Militants / Collectifs ────────────────────────────────────
  ['attabordelern', { minPoliticalScore: 3, tags: ['politique', 'association'] }],
  ['greenpeacefr', { minPoliticalScore: 2, tags: ['ecologie', 'militantisme'] }],
  ['amnestyfrance', { minPoliticalScore: 2, tags: ['droits-humains'] }],
  ['oxfamfrance', { minPoliticalScore: 2, tags: ['justice-sociale'] }],
  ['reporterssf', { minPoliticalScore: 2, tags: ['liberte-presse'] }],
]);

/**
 * Vérifie si un username correspond à un compte politique connu.
 * Retourne le score plancher et les tags, ou null.
 */
export function detectPoliticalAccount(username: string): PoliticalAccount | null {
  return POLITICAL_ACCOUNTS.get(username.toLowerCase()) || null;
}
