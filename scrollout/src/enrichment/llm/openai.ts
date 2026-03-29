/**
 * Provider OpenAI — GPT-4o-mini par défaut (low-cost).
 * Supporte la vision (multimodal) via content arrays.
 */
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionContentPart } from 'openai/resources/chat/completions';
import type { LLMProvider, LLMMessage, LLMResponse, LLMContentPart, LLMCallOptions } from './provider';

function toOpenAIContent(content: string | LLMContentPart[]): string | ChatCompletionContentPart[] {
  if (typeof content === 'string') return content;
  return content.map(part => {
    if (part.type === 'text') return { type: 'text' as const, text: part.text };
    return {
      type: 'image_url' as const,
      image_url: { url: part.image_url.url, detail: part.image_url.detail ?? 'low' },
    };
  });
}

function toOpenAIMessages(messages: LLMMessage[]): ChatCompletionMessageParam[] {
  return messages.map(m => ({
    role: m.role,
    content: toOpenAIContent(m.content),
  })) as ChatCompletionMessageParam[];
}

export function createOpenAIProvider(options?: {
  apiKey?: string;
  model?: string;
}): LLMProvider {
  const model = options?.model ?? 'gpt-4o-mini';
  const client = new OpenAI({
    apiKey: options?.apiKey ?? process.env.OPENAI_API_KEY,
  });

  return {
    name: 'openai',
    supportsVision: true,
    async call(messages: LLMMessage[], opts?: LLMCallOptions): Promise<LLMResponse> {
      const response = await client.chat.completions.create({
        model,
        messages: toOpenAIMessages(messages),
        temperature: opts?.temperature ?? 0.2,
        max_tokens: opts?.maxTokens ?? 2000,
        ...(opts?.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
      });

      const choice = response.choices[0];
      return {
        content: choice.message.content ?? '',
        model,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    },
  };
}
