/**
 * Abstraction LLM — Interface commune pour tous les providers.
 * Supporte les messages texte et multimodaux (vision).
 */

export type LLMContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' } };

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | LLMContentPart[];
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMCallOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json';
}

export interface LLMProvider {
  name: string;
  supportsVision?: boolean;
  call(messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse>;
}

/**
 * Extrait le texte brut d'un contenu LLM (string ou content parts).
 * Utile pour les providers qui ne supportent pas la vision.
 */
export function extractTextContent(content: string | LLMContentPart[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is Extract<LLMContentPart, { type: 'text' }> => p.type === 'text')
    .map(p => p.text)
    .join('\n');
}
