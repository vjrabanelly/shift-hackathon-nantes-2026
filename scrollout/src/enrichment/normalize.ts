/**
 * Normalisation de texte — Couche 4.
 * Fusionne caption + imageDesc (alt-text) + allText en un texte consolidé.
 * Nettoie les doublons, emojis excessifs, mentions, URLs.
 */

/**
 * Supprime les URLs d'un texte.
 */
function stripUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/gi, '').replace(/www\.\S+/gi, '');
}

/**
 * Supprime les mentions @username.
 */
function stripMentions(text: string): string {
  return text.replace(/@[\w.]+/g, '');
}

/**
 * Réduit les emojis consécutifs (max 2).
 */
function reduceEmojis(text: string): string {
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
  let consecutive = 0;
  let result = '';
  let lastIndex = 0;

  for (const match of text.matchAll(emojiRegex)) {
    const idx = match.index!;
    const before = text.slice(lastIndex, idx);

    if (before.trim() === '' && consecutive > 0) {
      consecutive++;
    } else {
      consecutive = 1;
    }

    result += before;
    if (consecutive <= 2) {
      result += match[0];
    }
    lastIndex = idx + match[0].length;
  }
  result += text.slice(lastIndex);
  return result;
}

/**
 * Supprime le bruit UI Instagram (boutons, navigation, métadonnées de l'app).
 */
function stripInstagramUI(text: string): string {
  const uiPatterns = [
    // Navigation & layout
    /Home\s+Reels\s+Envoyer un message\s+Rechercher et explorer\s+Profil/gi,
    /Plus d'actions pour cette publication/gi,
    /Fermer/gi,
    /Pour vous/gi,
    /Votre profil\.?\s*/gi,
    /Story vue/gi,
    /Ajouter à la story/gi,
    /Ajouter aux? enregistrements?/gi,
    // Suggestions & follows
    /Suggestions?\s+Suivre/gi,
    /Suggestion\s+Reel\s+de\s+[^,]+,\s*\d+\s+J'aime[^.]*\./gi,
    /Suggestion\s+Photo\s+de\s+[^,]+,\s*\d+\s+J'aime[^.]*\./gi,
    /Suggestion\s+(Reel|Photo)\s+de\s+[^,\n]+/gi,
    /Suggestions\b/gi,
    // Metadata de publication — J'aime/commentaires (apostrophe droite ' ou typographique ')
    /Photo de profil de \S+/gi,
    /\S+ a publié un\(e\) \S+ le [^.]+/gi,
    // English accessibility alt-texts (Instagram generates these)
    /Photo (?:by|shared by|posted by) [^.]+on [A-Z][a-z]+ \d{1,2},?\s*\d{4}[^.]*\.?/gi,
    /Video (?:by|shared by|posted by) [^.]+on [A-Z][a-z]+ \d{1,2},?\s*\d{4}[^.]*\.?/gi,
    /May be (?:an? )?(?:image|photo|illustration|cartoon|closeup|graphic|drawing|meme|screenshot|infographic) of [^.]+\.?/gi,
    /May be (?:an? )?(?:text|text that says)[^.]*\.?/gi,
    /No photo description available\.?/gi,
    /tagging [^.]+\.?/gi,
    /\d+ likes?,?\s*\d*\s*comments?/gi,
    /,?\s*[\d\s]+J['\u2019]aime,?\s*[\d\s]*commentaires?/gi,
    /Photo de [^,]+,\s*[\d\s]+J['\u2019]aime[^.\n]*\.?/gi,
    /Vidéo de [^,]+,\s*[\d\s]+J['\u2019]aime[^.\n]*\.?/gi,
    /[\d\s]+J['\u2019]aime/gi,
    /\d+\s+commentaires?/gi,
    /Photo \d+ de \d+ de [^,]+,?/gi,
    /Avatars?\s+utilisateurs?\s+\S+(\s+et\s+\S+)*/gi,
    // Réactions rapides (barre emoji Instagram) — séquence emojis + "J'aime" + "Direct"
    /R[ée]actions?\s+rapides?\s*[😂😮😍😢👏🔥🎉💯\s]*/gi,
    /[😂😮😍😢👏🔥🎉💯]{3,}/g,
    /J['\u2019]aime\s*Direct/gi,
    /\|\s*R[ée]actions?\s+rapides?/gi,
    // Menu hamburger / navigation résiduelle
    /hMenu\s*Fermer/gi,
    /hMenu/gi,
    // Pipes isolés (séparateurs UI résiduels)
    /\s*\|\s*(?=\s|$)/g,
    // [object Object] artifacts from non-stringified JS objects
    /\[object Object\]/g,
    // Actions & boutons UI
    /Voir la traduction/gi,
    /Vue\s+Grille\s+Reels\s+Photos de vous/gi,
    /Voir les personnes? identifiée?s?/gi,
    /Voir tous les \d+ commentaires/gi,
    /Sponsorisée/gi,
    /Activer le son/gi,
    /Réaction rapide/gi,
    /Envoyer un message/gi,
    /\bEnvoyer\b/gi,
    /\bPartager\b/gi,
    /\bEnregistrer\b/gi,
    /\bCommenter\b/gi,
    /\bS['\u2019]abonner\b/gi,
    /\bRépondre\b/gi,
    /\bDirect\b/gi,
    /\bSuivre\b/gi,
    // Stories
    /Story à la une de \S+[^.]*\./gi,
    /Story de \S+[^.]*\.?/gi,
    /Story à la une de \S+[^,\n]*/gi,
    /Story de \S+/gi,
    /\d+ sur \d+,\s*Vus\.?/gi,
    // Dates isolées (sans contenu sémantique) — inline et en début de ligne
    /il y a \d+\s+(?:jours?|heures?|minutes?|semaines?|mois|ans?)/gi,
    /^\d{1,2}\s+(?:janv(?:ier)?|févr(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|août|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|déc(?:embre)?)\s*(?:•.*)?$/gim,
    /\d{1,2}\s+(?:janv(?:ier)?|févr(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|août|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|déc(?:embre)?)\s*•[^\n]*/gi,
    // Résidu navigation — mots isolés en fin de ligne
    /^\s*(?:Suivre|Plus|plus)\s*$/gim,
    // "plus" isolé (bouton "voir plus") — en début de texte ou entouré d'espaces
    /^\s*plus\s*$/gim,
    // Résidu profil / stories highlights
    /dans la colonne \d+/gi,
    // Usernames répétés (pattern: "username username" — Instagram dédouble)
    /(\b[\w.]+)\s+\1\b/g,
    // "Publications suggérées" / "Suggestion pour vous"
    /Publications?\s+suggérées?/gi,
    /Suggestions?\s+pour\s+vous/gi,
    // Metadata compteurs isolés
    /\b\d+\s+publications?\b/gi,
    /\b\d+\s+abonnés?\b/gi,
    /\b\d+\s+abonnements?\b/gi,
  ];
  let result = text;
  for (const pattern of uiPatterns) {
    result = result.replace(pattern, '');
  }
  return result;
}

/**
 * Détecte si une caption est du pur bruit UI Instagram (pas de contenu sémantique).
 * Retourne true si la caption devrait être vidée.
 */
export function isCaptionPureNoise(caption: string): boolean {
  if (!caption || caption.length === 0) return true;
  const cleaned = stripInstagramUI(caption).trim();
  // Après nettoyage UI, il ne reste que des espaces, ponctuation, ou "..."
  if (cleaned.length === 0) return true;
  if (/^[.\s•,;:…\-–—]+$/.test(cleaned)) return true;
  // Captions qui sont juste une date ("15 mars", "il y a 3 jours")
  if (/^\d{1,2}\s+(?:janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)/i.test(cleaned) && cleaned.length < 30) return true;
  // Caption = juste "plus" / "plus..." / "Voir la traduction"
  if (/^(?:plus[.…]*|voir la traduction)\s*$/i.test(cleaned)) return true;
  return false;
}

/**
 * Normalise les espaces et sauts de ligne.
 */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Déduplique des segments de texte (évite la répétition caption dans allText).
 */
function deduplicateSegments(segments: string[]): string {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    // Normaliser pour comparaison (lowercase, sans ponctuation)
    const normalized = trimmed.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');

    // Vérifier si ce segment est déjà inclus dans un segment précédent ou vice versa
    let isDuplicate = false;
    for (const existing of seen) {
      if (existing.includes(normalized) || normalized.includes(existing)) {
        isDuplicate = true;
        // Garder le plus long
        if (normalized.length > existing.length) {
          seen.delete(existing);
          seen.add(normalized);
          // Remplacer dans unique
          const idx = unique.findIndex(u =>
            u.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ') === existing
          );
          if (idx !== -1) unique[idx] = trimmed;
        }
        break;
      }
    }

    if (!isDuplicate) {
      seen.add(normalized);
      unique.push(trimmed);
    }
  }

  return unique.join('\n\n');
}

/**
 * Détecte la langue principale d'un texte (heuristique simple).
 * Retourne 'fr', 'en', ou 'unknown'.
 */
export function detectLanguage(text: string): string {
  const lower = text.toLowerCase();
  const frWords = ['le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'est', 'sont', 'dans', 'pour', 'avec', 'sur', 'pas', 'qui', 'que', 'nous', 'vous', 'cette', 'ces', 'mais', 'aussi', 'comme', 'plus', 'tout', 'bien', 'très', 'ça'];
  const enWords = ['the', 'is', 'are', 'was', 'were', 'have', 'has', 'with', 'for', 'this', 'that', 'from', 'been', 'will', 'would', 'could', 'should', 'their', 'they', 'your', 'about', 'just', 'more', 'very'];

  const words = lower.split(/\s+/);
  let frCount = 0;
  let enCount = 0;

  for (const word of words) {
    if (frWords.includes(word)) frCount++;
    if (enWords.includes(word)) enCount++;
  }

  if (frCount === 0 && enCount === 0) return 'unknown';
  if (frCount > enCount) return 'fr';
  if (enCount > frCount) return 'en';
  return 'fr'; // default français pour un projet FR
}

/**
 * Produit le texte normalisé consolidé à partir des champs d'un post.
 */
export function normalizePostText(input: {
  caption: string;
  imageDesc: string;
  allText: string;
  hashtags: string[];
  ocrText?: string;
  subtitles?: string;
  audioTranscription?: string;
  mlkitLabelsText?: string;
}): {
  normalizedText: string;
  language: string;
  keywordTerms: string[];
} {
  // 1. Nettoyer chaque source
  // Caption: aussi passer par stripInstagramUI pour virer le bruit résiduel
  const rawCaption = isCaptionPureNoise(input.caption) ? '' : input.caption;
  const cleanCaption = normalizeWhitespace(stripInstagramUI(reduceEmojis(stripUrls(stripMentions(rawCaption)))));
  const cleanImageDesc = normalizeWhitespace(stripInstagramUI(input.imageDesc));
  const cleanAllText = normalizeWhitespace(stripInstagramUI(reduceEmojis(stripUrls(stripMentions(input.allText)))));

  // Sources vidéo (marquées pour le LLM)
  const segments = [cleanCaption, cleanImageDesc, cleanAllText];

  if (input.ocrText?.trim()) {
    segments.push(`[OCR] ${normalizeWhitespace(input.ocrText)}`);
  }
  if (input.subtitles?.trim()) {
    segments.push(`[SUBTITLES] ${normalizeWhitespace(input.subtitles)}`);
  }
  if (input.audioTranscription?.trim()) {
    segments.push(`[AUDIO_TRANSCRIPT] ${normalizeWhitespace(input.audioTranscription)}`);
  }
  if (input.mlkitLabelsText?.trim()) {
    segments.push(input.mlkitLabelsText);
  }

  // 2. Dédupliquer et fusionner
  const normalizedText = deduplicateSegments(segments);

  // 3. Détecter la langue
  const language = detectLanguage(normalizedText);

  // 4. Extraire les termes-clés (hashtags nettoyés + mots significatifs)
  const keywordTerms = input.hashtags
    .map(h => h.replace(/^#/, '').toLowerCase())
    .filter(h => h.length > 2);

  return { normalizedText, language, keywordTerms };
}
