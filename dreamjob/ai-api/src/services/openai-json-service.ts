import OpenAI from "openai";

import { config } from "../config";

export class OpenAIJsonService {
  private client: OpenAI | null;

  constructor() {
    this.client = config.openAiApiKey
      ? new OpenAI({ apiKey: config.openAiApiKey })
      : null;
  }

  async generateJson<T>(options: {
    model: string;
    reasoningEffort: "low" | "medium" | "high";
    instructions: string;
    input: unknown;
  }): Promise<T> {
    if (!this.client) {
      throw new Error("OPENAI_API_KEY is missing");
    }

    const prompt = [
      options.instructions,
      "",
      "Return only valid JSON. No markdown. No code fences.",
      "",
      "INPUT JSON:",
      JSON.stringify(options.input, null, 2)
    ].join("\n");

    const response = await this.client.responses.create({
      model: options.model,
      reasoning: {
        effort: options.reasoningEffort
      },
      input: prompt
    });

    return this.parseJson<T>(response.output_text);
  }

  private parseJson<T>(payload: string): T {
    const normalized = payload
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");

    return JSON.parse(normalized) as T;
  }
}
