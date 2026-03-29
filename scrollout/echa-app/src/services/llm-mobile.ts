/**
 * LLM Mobile — appelle l'API OpenAI depuis l'app mobile.
 * Léger, pas de dépendance npm (fetch natif).
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export interface LLMConfig {
  apiKey: string;
  model?: string;        // défaut: gpt-4o-mini
  maxTokens?: number;
  temperature?: number;
}

const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Appelle l'API OpenAI chat completions.
 */
export async function callOpenAI(
  messages: LLMMessage[],
  config: LLMConfig,
): Promise<LLMResponse> {
  const model = config.model || DEFAULT_MODEL;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: config.maxTokens || 2000,
      temperature: config.temperature ?? 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content || '{}',
    model: data.model || model,
    usage: data.usage,
  };
}

// ── Enrichment prompt (version mobile, identique au PC) ──────

const SYSTEM_PROMPT = `Tu es un sémiologue spécialisé dans l'analyse de contenu Instagram francophone.
Tu dois produire une analyse structurée en JSON, rigoureuse et factuelle.

RÈGLE FONDAMENTALE — SÉMIOLOGIE, PAS DESCRIPTION :
Tu ne décris PAS le post. Tu identifies son SUJET FACTUEL et son ANGLE.

- semantic_summary = observation sémiologique FACTUELLE, SPÉCIFIQUE, VARIÉE (15 mots max). Nomme le sujet précis, pas une catégorie générique.
- INTERDIT : les formules templates "X comme art de vivre", "X comme expression personnelle", "X comme moyen de Y". Sois CONCRET et UNIQUE.
- Mauvais : "Promotion de la littérature via des publications d'éditeurs" (descriptif creux)
- Mauvais : "L'esthétique comme expression personnelle et sociale" (template vide)
- Bon : "Nouveau roman SF de Becky Chambers chez L'Atalante, niche littéraire feel-good"
- Bon : "Partie de Wingspan entre amis, valorisation du jeu de plateau expert"
- Bon : "Ramen tonkotsu fait maison, 12h de bouillon — cuisine japonaise puriste"
- Bon : "Donald Duck nu dans les films Disney, absurdité pointée par Boulet en BD"
- Bon : "Municipales annulées à Poitiers, recours juridique contre le maire sortant"
- Chaque summary doit être UNIQUE et SPÉCIFIQUE au post. Si deux posts ont le même summary, c'est raté.

- Le @username est le SIGNAL LE PLUS FORT. @labriqueludique = jeux de société, pas sport. @franceculture = culture, pas lifestyle.
- Si les indices pré-calculés (règles) disent "divertissement/jeux de société", fais confiance sauf preuve contraire dans le texte.
- media_message = le sous-texte que le spectateur retient, formulé factuellement
- media_intent = l'EFFET RECHERCHÉ sur le spectateur

AUTRES RÈGLES :
- Tu mesures le CONTENU du post, pas l'opinion de l'auteur ni du lecteur.
- Tu évalues l'EXPOSITION à un type de contenu, pas l'adhésion.
- Sois conservateur dans tes scores : en cas de doute, score bas.
- main_topics ne doit JAMAIS être vide []. Même un post très pauvre a un domaine identifiable via le username ou le type de média.

Réponds UNIQUEMENT en JSON valide.`;

export function buildEnrichmentPrompt(post: {
  normalizedText: string;
  username: string;
  hashtags: string[];
  mediaType?: string;
  rulesHints?: {
    mainTopics: string[];
    subjects?: { id: string; label: string; themeId: string }[];
    politicalScore: number;
    polarizationScore: number;
    detectedActors: string[];
  };
  candidatePreciseSubjects?: { id: string; statement: string }[];
}): string {
  const subjectsStr = post.rulesHints?.subjects?.length
    ? `, subjects=[${post.rulesHints.subjects.map(s => s.id).join(',')}]`
    : '';
  const rulesContext = post.rulesHints?.mainTopics.length
    ? `\nIndices pré-calculés (règles) : topics=[${post.rulesHints.mainTopics.join(',')}]${subjectsStr}, political_score=${post.rulesHints.politicalScore}, polarization=${post.rulesHints.polarizationScore}, actors=[${post.rulesHints.detectedActors.join(',')}]`
    : '';

  let preciseSubjectsBlock = '';
  if (post.candidatePreciseSubjects && post.candidatePreciseSubjects.length > 0) {
    const lines = post.candidatePreciseSubjects.map(ps => `  - ${ps.id}: "${ps.statement}"`).join('\n');
    preciseSubjectsBlock = `\n\nSUJETS PRÉCIS CANDIDATS (choisis ceux qui correspondent au post, 0 à 3 max) :\n${lines}`;
  }

  return `Analyse ce post Instagram et produis un JSON structuré.

IMPORTANT — RÈGLES CRITIQUES :
1. Le @username est un signal sémantique fort (ex: @boardgamegeek → jeux de société, @franceculture → culture/média).
2. main_topics ne doit JAMAIS être vide []. En dernier recours, utilise "divertissement" ou "lifestyle".
3. semantic_summary = le PROPOS, la THÈSE, le MESSAGE SÉMIOLOGIQUE. Pas de "Le compte partage...", pas de description de format. Commence par le sujet. Ex: "Critique de l'absurdité des remakes Disney via l'humour décalé", "La charge mentale des mères invisibilisée par l'injonction au bonheur".
4. subjects = les SUJETS CONCRETS du fond (pas de la forme). Ex: "nostalgie Disney", "charge mentale", "réforme retraites".

--- POST ---
Auteur : @${post.username}
Type : ${post.mediaType || 'photo'}
Hashtags : ${post.hashtags.join(', ') || '(aucun)'}
Texte :
${post.normalizedText.substring(0, 1500)}
${rulesContext}${preciseSubjectsBlock}
--- FIN POST ---

LISTE DES 31 THÈMES (utilise UNIQUEMENT ces identifiants) :
- actualite : info, breaking news, faits divers
- politique : élections, partis, lois, institutions FR
- geopolitique : conflits internationaux, diplomatie
- economie : emploi, inflation, pouvoir d'achat
- ecologie : climat, biodiversité, pollution
- immigration : migration, intégration, frontières
- securite : police, délinquance, terrorisme
- justice : droit, procès, réformes judiciaires
- sante : médecine, bien-être physique
- religion : islam, christianisme, laïcité, spiritualité
- education : école, université, formation
- culture : cinéma, musique, séries, littérature, art, BD
- humour : memes, satire, parodie
- divertissement : jeux de société, jeux de plateau, gaming, people, anime, contenus viraux
- lifestyle : mode, fashion, routine, organisation, productivité
- beaute : skincare, maquillage, coiffure
- food : recettes, restaurants, gastronomie, boissons, alimentation saine
- voyage : destinations, backpacking, transport, hébergement
- maison_jardin : déco intérieur, bricolage, rénovation, jardinage, plantes
- animaux : chiens, chats, animaux de compagnie, protection animale
- parentalite : grossesse, naissance, éducation des enfants, vie de famille
- automobile : voitures, motos, véhicules électriques, tuning
- shopping : hauls, unboxing, reviews produits, bons plans, promos
- sport : football, fitness, MMA, JO (PAS jeux de société)
- business : entrepreneuriat, crypto, coaching, investissement
- developpement_personnel : méditation, motivation, astrologie
- technologie : IA, dev, gadgets, apps
- feminisme : droits des femmes, patriarcat
- masculinite : manosphère, redpill, masculinité positive
- identite : racisme, LGBTQ+, diaspora
- societe : inégalités, vivre-ensemble

Produis un JSON avec ces champs :
{
  "semantic_summary": "Observation FACTUELLE et SPÉCIFIQUE (15 mots max). Nomme le sujet CONCRET, pas une catégorie. INTERDIT les formules 'X comme art de vivre/expression personnelle'. Chaque summary doit être UNIQUE.",
  "main_topics": ["1-3 thèmes. JAMAIS vide."],
  "secondary_topics": ["0-3 thèmes secondaires"],
  "subjects": ["Sujets CONCRETS du fond (niveau 3). Ex: 'cuisine japonaise', 'réforme retraites', 'nostalgie Disney'. Décris le FOND."],
  "precise_subjects": [{"id": "ID du sujet précis si candidat fourni, sinon null", "position": "pour|contre|neutre|ambigu", "confidence": 0.0-1.0}],
  "persons": ["personnes nommées"],
  "organizations": ["organisations mentionnées"],
  "institutions": ["institutions publiques"],
  "countries": ["pays mentionnés"],
  "tone": "informatif|émotionnel|sarcastique|militant|neutre|inspirant|alarmiste",
  "primary_emotion": "colère|joie|peur|tristesse|dégoût|surprise|fierté|espoir|neutre",
  "emotion_intensity": 0.0-1.0,
  "political_explicitness_score": 0-4,
  "polarization_score": 0.0-1.0,
  "ingroup_outgroup_signal": true/false,
  "conflict_signal": true/false,
  "moral_absolute_signal": true/false,
  "enemy_designation_signal": true/false,
  "activism_signal": true/false,
  "narrative_frame": "declin|urgence|injustice|revelation|mobilisation|denonciation|empowerment|ordre|menace|aspiration|inspiration|derision|victimisation|heroisation|aucun",
  "call_to_action_type": "aucun|commenter|partager|sindigner|sinformer|voter|soutenir|boycotter|acheter|suivre_le_compte",
  "media_hook": "Version FUN et EDITORIALE du summary, comme un titre de magazine. Court, percutant, avec de la personnalité. Ex: 'Ton feed sent le bouillon 12h', 'Disney a habillé tout le monde sauf Donald', 'La Terre brûle mais t'as liké'.",
  "media_message": "Le sous-texte factuel que le spectateur retient.",
  "media_intent": "informer|divertir|vendre|convaincre|emouvoir|eduquer|provoquer|aucun",
  "confidence_score": 0.0-1.0
}

ÉCHELLE POLITIQUE : 0=apolitique, 1=social sans enjeu, 2=enjeu public indirect, 3=politique explicite, 4=militant
ÉCHELLE POLARISATION : 0=neutre, 0.1-0.3=orienté, 0.3-0.6=position nette, 0.6-0.8=opposition binaire, 0.8-1.0=hautement polarisant

Réponds UNIQUEMENT avec le JSON.`;
}

export { SYSTEM_PROMPT };

// ── Batch LLM — plusieurs posts en un seul appel ───────────

export interface BatchPost {
  index: number;
  username: string;
  normalizedText: string;
  hashtags: string[];
  mediaType?: string;
  rulesHints?: {
    mainTopics: string[];
    politicalScore: number;
    polarizationScore: number;
    detectedActors: string[];
  };
}

/**
 * Envoie jusqu'à 5 posts dans un seul appel OpenAI.
 * Retourne un tableau de résultats JSON indexés.
 */
export async function callOpenAIBatch(
  posts: BatchPost[],
  config: LLMConfig,
): Promise<{ index: number; result: any }[]> {
  const model = config.model || DEFAULT_MODEL;

  const postsBlock = posts.map(p => {
    const hints = p.rulesHints?.mainTopics.length
      ? `\nIndices règles: topics=[${p.rulesHints.mainTopics.join(',')}], pol=${p.rulesHints.politicalScore}`
      : '';
    return `[POST ${p.index}]
Auteur: @${p.username} | Type: ${p.mediaType || 'photo'}
Hashtags: ${p.hashtags.join(', ') || '(aucun)'}
Texte: ${p.normalizedText.substring(0, 600)}${hints}
[/POST ${p.index}]`;
  }).join('\n\n');

  const prompt = `Analyse ces ${posts.length} posts Instagram et produis un JSON avec un tableau "posts".

RÈGLE SÉMIOLOGIQUE : semantic_summary = observation FACTUELLE et SPÉCIFIQUE (15 mots max). Nomme le sujet CONCRET (pas une catégorie). INTERDIT "X comme art de vivre/expression personnelle" — sois UNIQUE par post. Le @username est le signal le plus fort. Fais confiance aux indices règles sauf preuve contraire.

${postsBlock}

THÈMES (IDs uniquement) : actualite, politique, geopolitique, economie, ecologie, immigration, securite, justice, sante, religion, education, culture, humour, divertissement, lifestyle, beaute, sport, business, developpement_personnel, technologie, feminisme, masculinite, identite, societe, food, voyage, maison_jardin, animaux, parentalite, automobile, shopping

Réponds avec ce JSON :
{
  "posts": [
    {
      "index": 0,
      "semantic_summary": "Observation FACTUELLE et SPÉCIFIQUE (15 mots max). Sujet CONCRET, pas de template. Chaque summary UNIQUE.",
      "main_topics": ["1-3 thèmes. JAMAIS vide."],
      "secondary_topics": ["0-2"],
      "subjects": ["sujets concrets du fond"],
      "persons": ["personnes nommées"],
      "organizations": ["organisations"],
      "institutions": ["institutions"],
      "countries": ["pays"],
      "tone": "informatif|émotionnel|sarcastique|militant|neutre|inspirant|alarmiste",
      "primary_emotion": "neutre|joie|colère|...",
      "emotion_intensity": 0.0-1.0,
      "political_explicitness_score": 0-4,
      "polarization_score": 0.0-1.0,
      "narrative_frame": "aucun|declin|urgence|...",
      "media_hook": "Titre de magazine FUN et percutant (court)",
      "media_message": "Sous-texte factuel retenu par le spectateur",
      "media_intent": "informer|divertir|vendre|...",
      "confidence_score": 0.0-1.0
    }
  ]
}

ÉCHELLE POLITIQUE : 0=apolitique, 1=social sans enjeu, 2=enjeu public, 3=politique explicite, 4=militant
JSON uniquement.`;

  const messages: LLMMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: Math.min(posts.length * 400, 4000),
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Batch ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);
  return (parsed.posts || []).map((p: any) => ({
    index: p.index ?? 0,
    result: p,
  }));
}

// ── Whisper API — transcription audio pour vidéos ───────────

/**
 * Télécharge une vidéo depuis son URL CDN et envoie l'audio à Whisper API.
 * Retourne le texte transcrit ou null en cas d'erreur.
 */
export async function callWhisperAPI(
  videoUrl: string,
  apiKey: string,
): Promise<string | null> {
  try {
    // 1. Télécharger la vidéo (les CDN Instagram renvoient du mp4)
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      console.log(`[whisper] Download failed: ${videoResponse.status}`);
      return null;
    }

    const videoBlob = await videoResponse.blob();

    // Vérifier la taille (skip si > 25MB — limite Whisper API)
    if (videoBlob.size > 25 * 1024 * 1024) {
      console.log(`[whisper] Video too large: ${(videoBlob.size / 1024 / 1024).toFixed(1)}MB`);
      return null;
    }

    // 2. Envoyer à Whisper API (accepte directement le mp4)
    const formData = new FormData();
    formData.append('file', videoBlob, 'video.mp4');
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr'); // priorité français
    formData.append('response_format', 'json');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.log(`[whisper] API error ${whisperResponse.status}: ${errorText.substring(0, 200)}`);
      return null;
    }

    const result = await whisperResponse.json();
    return result.text || null;
  } catch (err) {
    console.log(`[whisper] Error: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/**
 * Évalue la qualité d'une transcription Whisper.
 * Détecte le charabia, les répétitions, et le contenu trop court.
 */
export function evaluateTranscriptionQuality(text: string): {
  acceptable: boolean;
  reason: string;
} {
  if (!text || text.trim().length === 0) {
    return { acceptable: false, reason: 'empty' };
  }

  const words = text.trim().split(/\s+/);

  // Trop court
  if (words.length < 5) {
    return { acceptable: false, reason: `too_short: ${words.length} words` };
  }

  // Détection de répétitions excessives (Whisper hallucine parfois en boucle)
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const uniqueRatio = uniqueWords.size / words.length;
  if (words.length > 10 && uniqueRatio < 0.3) {
    return { acceptable: false, reason: `repetitive: ${(uniqueRatio * 100).toFixed(0)}% unique` };
  }

  // Détection de "musique only" (Whisper transcrit souvent "[Musique]" en boucle)
  const musicPatterns = /^\[?(musique|music|applause|rires|laughter)\]?$/i;
  const musicWords = words.filter(w => musicPatterns.test(w));
  if (musicWords.length > words.length * 0.5) {
    return { acceptable: false, reason: 'music_only' };
  }

  return { acceptable: true, reason: 'ok' };
}

// ── Vision LLM — analyse d'image pour posts visuels ─────────

/**
 * Appelle GPT-4o avec une image pour enrichir un post visuel.
 * Utilisé quand le texte est trop pauvre pour classifier.
 */
export async function callOpenAIVision(
  imageUrl: string,
  post: { normalizedText: string; username: string; hashtags: string[]; mediaType?: string },
  config: LLMConfig,
): Promise<LLMResponse> {
  const model = 'gpt-4o-mini'; // supporte vision nativement

  const userContent = [
    {
      type: 'image_url',
      image_url: { url: imageUrl, detail: 'low' }, // 85 tokens, économe
    },
    {
      type: 'text',
      text: `Analyse ce post Instagram en utilisant L'IMAGE et le texte.
L'image est le contenu principal — le texte peut être pauvre.

Auteur: @${post.username}
Type: ${post.mediaType || 'photo'}
Hashtags: ${post.hashtags.join(', ') || 'aucun'}
Texte: ${post.normalizedText.substring(0, 800)}

Produis un JSON avec: semantic_summary, main_topics (1-3, JAMAIS vide), secondary_topics, tone, primary_emotion, emotion_intensity, political_explicitness_score (0-4), polarization_score (0-1), ingroup_outgroup_signal, conflict_signal, moral_absolute_signal, enemy_designation_signal, activism_signal, narrative_frame, media_intent, confidence_score.

Topics: actualite, politique, geopolitique, economie, ecologie, immigration, securite, justice, sante, religion, education, culture, humour, divertissement, lifestyle, beaute, sport, business, developpement_personnel, technologie, feminisme, masculinite, identite, societe.

JSON uniquement.`,
    },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: 1500,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Vision ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content || '{}',
    model: data.model || model,
    usage: data.usage,
  };
}
