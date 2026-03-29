import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import { createLogger } from '../log';
import { ProviderTypeEnum, type ProviderConfig, speechToTextModelStore } from '@extension/storage';
import { t } from '@extension/i18n';

const logger = createLogger('SpeechToText');

type SpeechToTextClient =
  | {
      type: ProviderTypeEnum.Gemini;
      llm: ChatGoogleGenerativeAI;
    }
  | {
      type: ProviderTypeEnum.OpenAI | ProviderTypeEnum.CustomOpenAI;
      apiKey: string;
      baseUrl: string;
      modelName: string;
    };

export class SpeechToTextService {
  private client: SpeechToTextClient;

  private constructor(client: SpeechToTextClient) {
    this.client = client;
  }

  static async create(providers: Record<string, ProviderConfig>): Promise<SpeechToTextService> {
    try {
      const config = await speechToTextModelStore.getSpeechToTextModel();

      if (!config?.provider || !config?.modelName) {
        throw new Error(t('chat_stt_model_notFound'));
      }

      const provider = providers[config.provider];
      logger.info('Found provider for speech-to-text:', provider ? 'yes' : 'no', provider?.type);

      if (!provider?.type) {
        throw new Error(t('chat_stt_model_notFound'));
      }

      let client: SpeechToTextClient;

      if (provider.type === ProviderTypeEnum.Gemini) {
        client = {
          type: ProviderTypeEnum.Gemini,
          llm: new ChatGoogleGenerativeAI({
            model: config.modelName,
            apiKey: provider.apiKey,
            temperature: 0.1,
            topP: 0.8,
          }),
        };
      } else if (provider.type === ProviderTypeEnum.OpenAI || provider.type === ProviderTypeEnum.CustomOpenAI) {
        const baseUrl = provider.baseUrl?.trim() || 'https://api.openai.com/v1';

        client = {
          type: provider.type,
          apiKey: provider.apiKey,
          baseUrl,
          modelName: config.modelName,
        };
      } else {
        throw new Error(t('chat_stt_model_notFound'));
      }

      logger.info(`Speech-to-text service created with model: ${config.modelName}`);
      return new SpeechToTextService(client);
    } catch (error) {
      logger.error('Failed to create speech-to-text service:', error);
      throw error;
    }
  }

  async transcribeAudio(base64Audio: string): Promise<string> {
    if (this.client.type === ProviderTypeEnum.Gemini) {
      return this.transcribeWithGemini(base64Audio);
    }

    return this.transcribeWithOpenAI(base64Audio);
  }

  private async transcribeWithGemini(base64Audio: string): Promise<string> {
    try {
      logger.info('Starting audio transcription...');
      const llm = this.client.type === ProviderTypeEnum.Gemini ? this.client.llm : null;

      if (!llm) {
        throw new Error(t('chat_stt_model_notFound'));
      }

      // Create transcription message with audio data
      const transcriptionMessage = new HumanMessage({
        content: [
          {
            type: 'text',
            text: 'Transcribe this audio. Return only the transcribed text without any additional formatting or explanations.',
          },
          {
            type: 'media',
            data: base64Audio,
            mimeType: 'audio/webm',
          },
        ],
      });

      // Get transcription from Gemini
      const transcriptionResponse = await llm.invoke([transcriptionMessage]);

      const transcribedText = transcriptionResponse.content.toString().trim();
      logger.info('Audio transcription completed:', transcribedText);

      return transcribedText;
    } catch (error) {
      logger.error('Failed to transcribe audio:', error);
      throw new Error(`Speech transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async transcribeWithOpenAI(base64Audio: string): Promise<string> {
    try {
      logger.info('Starting OpenAI audio transcription...');
      const openAIClient =
        this.client.type === ProviderTypeEnum.OpenAI || this.client.type === ProviderTypeEnum.CustomOpenAI
          ? this.client
          : null;

      if (!openAIClient) {
        throw new Error(t('chat_stt_model_notFound'));
      }

      const audioBlob = SpeechToTextService.base64ToBlob(base64Audio, 'audio/webm');
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('model', openAIClient.modelName);
      formData.append('language', 'fr');

      const response = await fetch(`${openAIClient.baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAIClient.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI transcription request failed (${response.status}): ${errorText}`);
      }

      const result = (await response.json()) as { text?: string };
      const transcribedText = result.text?.trim();

      if (!transcribedText) {
        throw new Error('OpenAI transcription returned empty text.');
      }

      logger.info('OpenAI audio transcription completed:', transcribedText);
      return transcribedText;
    } catch (error) {
      logger.error('Failed to transcribe audio with OpenAI:', error);
      throw new Error(`Speech transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static base64ToBlob(base64Data: string, mimeType: string): Blob {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  }
}
