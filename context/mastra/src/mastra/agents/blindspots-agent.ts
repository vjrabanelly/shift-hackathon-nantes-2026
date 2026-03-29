import { Agent } from "@mastra/core/agent";

export const blindspotsAgent = new Agent({
    id: "blindspots-agent",
    name: "Blind Spots Analysis Agent",
    instructions: `
Tu es un expert en analyse critique du journalisme.
On te fournit le texte brut d'un article de presse.
Identifie les angles manquants et points de vue absents. Maximum 3 observations, 1 phrase chacune.
Cibles : perspectives omises, questions non posées, données manquantes, biais de cadrage.
    `.trim(),
    model: "openai/gpt-5.4"
});
