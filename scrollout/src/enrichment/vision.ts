/**
 * Vision enrichment — analyse d'image via GPT-4o pour les posts à signal faible.
 * Envoie l'URL CDN Instagram directement à OpenAI (pas de téléchargement).
 */
import type { LLMMessage, LLMContentPart, LLMProvider } from './llm/provider';
import { ENRICHMENT_SYSTEM_PROMPT } from './llm/prompts';
import type { EnrichmentPromptInput } from './llm/prompts';

export interface VisionOptions {
  detail?: 'low' | 'high';
}

/**
 * Détermine si un post devrait bénéficier de l'analyse vision.
 */
export function shouldUseVision(
  normalizedText: string,
  rulesConfidence: number,
  imageUrls: string[],
): boolean {
  if (imageUrls.length === 0) return false;

  const words = normalizedText.split(/\s+/).filter(w => w.length > 2);
  const wordCount = words.length;

  // Post pauvre en texte avec des images
  if (wordCount < 30) return true;

  // Confiance rules très basse malgré du texte
  if (rulesConfidence < 0.35) return true;

  return false;
}

/**
 * Construit les messages LLM multimodaux pour l'analyse vision.
 * Reprend le même format de sortie JSON que le prompt texte standard
 * pour que le merge dans pipeline.ts fonctionne identiquement.
 */
export function buildVisionMessages(
  imageUrl: string,
  input: EnrichmentPromptInput,
  visionOptions?: VisionOptions,
): LLMMessage[] {
  const detail = visionOptions?.detail ?? 'low';

  const hashtagStr = input.hashtags.length > 0 ? input.hashtags.join(', ') : '(aucun)';
  const rulesContext = input.rulesHints.mainTopics.length > 0
    ? `\nIndices pré-calculés (règles) : topics=[${input.rulesHints.mainTopics.join(',')}], subjects=[${input.rulesHints.subjects.map(s => s.id).join(',')}], political_score=${input.rulesHints.politicalScore}, polarization=${input.rulesHints.polarizationScore}`
    : '';

  let preciseSubjectsBlock = '';
  if (input.candidatePreciseSubjects && input.candidatePreciseSubjects.length > 0) {
    const lines = input.candidatePreciseSubjects.map(ps => `  - ${ps.id}: "${ps.statement}"`).join('\n');
    preciseSubjectsBlock = `\n\nSUJETS PRÉCIS CANDIDATS :\n${lines}`;
  }

  const userContent: LLMContentPart[] = [
    {
      type: 'image_url',
      image_url: { url: imageUrl, detail },
    },
    {
      type: 'text',
      text: `Analyse ce post Instagram en utilisant à la fois L'IMAGE et le texte ci-dessous.

L'image est le contenu principal — le texte peut être pauvre ou absent.
Utilise l'image pour déterminer le sujet, le ton, les objets visibles, le texte incrusté, et le message véhiculé.

--- POST ---
Auteur : @${input.username}
Type : ${input.mediaType}
Hashtags : ${hashtagStr}
Texte :
${input.normalizedText || '(texte vide ou non disponible)'}
${rulesContext}${preciseSubjectsBlock}
--- FIN POST ---

Produis un JSON avec EXACTEMENT ces champs :

{
  "semantic_summary": "résumé en 1-2 phrases du contenu (image + texte combinés)",
  "main_topics": ["1-3 thèmes parmi: actualite, politique, geopolitique, economie, ecologie, immigration, securite, justice, sante, religion, education, culture, humour, divertissement, lifestyle, beaute, sport, business, developpement_personnel, technologie, feminisme, masculinite, identite, societe"],
  "secondary_topics": ["0-3 thèmes secondaires"],
  "subjects": ["IDs des sujets détectés (niveau 3 de la taxonomie)"],
  "precise_subjects": [{"id": "ID du sujet précis si candidat fourni", "position": "pour | contre | neutre | ambigu", "confidence": 0.0 à 1.0}],
  "content_domain": "actualité | divertissement | lifestyle | politique | éducation | business | autre",
  "audience_target": "grand public | militant | niche | communautaire | professionnel",
  "persons": ["personnes identifiées (image ou texte)"],
  "organizations": ["organisations"],
  "institutions": ["institutions publiques"],
  "countries": ["pays"],
  "tone": "informatif | émotionnel | sarcastique | militant | neutre | inspirant | alarmiste",
  "primary_emotion": "colère | joie | peur | tristesse | dégoût | surprise | fierté | espoir | neutre",
  "emotion_intensity": 0.0 à 1.0,
  "political_explicitness_score": 0 à 4,
  "political_explicitness_justification": "justification en 1 phrase",
  "political_issue_tags": ["enjeux politiques identifiés"],
  "public_policy_tags": ["politiques publiques mentionnées"],
  "institutional_reference_score": 0.0 à 1.0,
  "activism_signal": true/false,
  "polarization_score": 0.0 à 1.0,
  "polarization_justification": "justification en 1 phrase",
  "ingroup_outgroup_signal": true/false,
  "conflict_signal": true/false,
  "moral_absolute_signal": true/false,
  "enemy_designation_signal": true/false,
  "narrative_frame": "declin | urgence | injustice | revelation | mobilisation | denonciation | empowerment | ordre | menace | aspiration | inspiration | derision | victimisation | heroisation | aucun",
  "call_to_action_type": "aucun | commenter | partager | sindigner | sinformer | voter | soutenir | boycotter | manifester | acheter | suivre_le_compte",
  "problem_solution_pattern": "",
  "visual_description": "description détaillée de ce que montre l'image (objets, personnes, texte visible, symboles, couleurs dominantes)",
  "text_in_image": "tout texte lisible dans l'image (pancartes, titres, légendes, overlay)",
  "media_message": "message principal véhiculé par le média visuel",
  "media_intent": "informer | divertir | vendre | convaincre | emouvoir | eduquer | provoquer | aucun",
  "confidence_score": 0.0 à 1.0
}

ÉCHELLE POLITIQUE :
0 = apolitique, 1 = social/culturel, 2 = enjeu public indirect, 3 = politique explicite, 4 = militant

Réponds UNIQUEMENT avec le JSON.`,
    },
  ];

  return [
    { role: 'system', content: ENRICHMENT_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}

/**
 * Appelle le LLM en mode vision pour enrichir un post.
 * Retourne null si le provider ne supporte pas la vision ou en cas d'erreur.
 */
export async function callVisionLLM(
  provider: LLMProvider,
  imageUrl: string,
  input: EnrichmentPromptInput,
  visionOptions?: VisionOptions,
): Promise<Record<string, unknown> | null> {
  if (!provider.supportsVision) {
    console.log('[vision] Provider does not support vision, skipping');
    return null;
  }

  const messages = buildVisionMessages(imageUrl, input, visionOptions);

  try {
    const response = await provider.call(messages, {
      temperature: 0.2,
      maxTokens: 2500,
      responseFormat: 'json',
    });

    return JSON.parse(response.content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // CDN URL expired or rate limit
    if (msg.includes('Could not process') || msg.includes('invalid_image') || msg.includes('400')) {
      console.log(`[vision] Image URL likely expired or invalid: ${msg.substring(0, 80)}`);
    } else {
      console.error(`[vision] LLM error:`, msg);
    }
    return null;
  }
}
