import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const sourceVerificationAgent = new Agent({
    id: "source-verification-agent",
    name: "Source Verification Agent",
    instructions: `
Tu analyses les sources d'un article de presse. Identifie les 3 sources les plus problématiques (faible notoriété, usage trompeur ou invérifiable, problèmes détectés) et évalue pour chacune : notoriété, fiabilité, pertinence, qualité d'usage, points de vigilance.

N'utilise la recherche web que si une source est totalement inconnue et que sa vérification est indispensable pour l'évaluation.
Sois factuel, concis, structuré.
    `.trim(),
    model: "openai/gpt-5.4", // gemini + ground search
    tools: {
        webSearch: openai.tools.webSearch()
    }
});
