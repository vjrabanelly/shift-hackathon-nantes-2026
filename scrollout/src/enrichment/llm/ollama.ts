/**
 * Provider Ollama — modèles locaux (gratuit, offline).
 * Ollama expose une API compatible OpenAI sur localhost:11434.
 * Ne supporte pas la vision — les images sont ignorées, seul le texte est envoyé.
 */
import type { LLMProvider, LLMMessage, LLMResponse, LLMCallOptions } from './provider';
import { extractTextContent } from './provider';

export function createOllamaProvider(options?: {
  baseUrl?: string;
  model?: string;
}): LLMProvider {
  const baseUrl = options?.baseUrl ?? 'http://localhost:11434';
  const model = options?.model ?? 'llama3.1:8b';

  return {
    name: 'ollama',
    supportsVision: false,
    async call(messages: LLMMessage[], opts?: LLMCallOptions): Promise<LLMResponse> {
      // Strip image parts — Ollama text-only
      const textMessages = messages.map(m => ({
        role: m.role,
        content: extractTextContent(m.content),
      }));

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: textMessages,
          stream: false,
          options: {
            temperature: opts?.temperature ?? 0.2,
            num_predict: opts?.maxTokens ?? 2000,
          },
          ...(opts?.responseFormat === 'json' ? { format: 'json' } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as {
        message: { content: string };
        model: string;
        eval_count?: number;
        prompt_eval_count?: number;
      };

      return {
        content: data.message.content,
        model,
        usage: data.eval_count ? {
          promptTokens: data.prompt_eval_count ?? 0,
          completionTokens: data.eval_count,
          totalTokens: (data.prompt_eval_count ?? 0) + data.eval_count,
        } : undefined,
      };
    },
  };
}
