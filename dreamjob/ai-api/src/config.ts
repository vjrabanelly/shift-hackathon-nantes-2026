import "dotenv/config";

export interface AgentModelSettings {
  model: string;
  reasoningEffort: "low" | "medium" | "high";
}

export const config = {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  dataPath: process.cwd() + "/data/candidates.json",
  generatedResultPath: process.cwd() + "/generate_by_ai.json",
  models: {
    candidate: {
      model: process.env.OPENAI_MODEL_CANDIDATE ?? "gpt-5.4",
      reasoningEffort: "medium"
    } satisfies AgentModelSettings,
    ats: {
      model: process.env.OPENAI_MODEL_ATS ?? "gpt-5-mini",
      reasoningEffort: "low"
    } satisfies AgentModelSettings,
    recruiter: {
      model: process.env.OPENAI_MODEL_RECRUITER ?? "gpt-5-mini",
      reasoningEffort: "low"
    } satisfies AgentModelSettings
  }
};
