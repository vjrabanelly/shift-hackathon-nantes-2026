import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const mediaAgent = new Agent({
    id: "media-agent",
    name: "Media Research Agent",
    instructions: `
Tu es un expert en analyse des médias et de leurs liens d'intérêts.
On te fournit le nom d'un média et le sujet d'un article qu'il a publié.
Maximum 4 phrases. Utilise ton outil de recherche web pour identifier :
- propriétaire et actionnaires principaux
- conflits d'intérêts éventuels avec le sujet de l'article
Sois factuel. Si aucun conflit évident, indique-le en une phrase.
    `.trim(),
    model: "openai/gpt-5.4",
    tools: {
        webSearch: openai.tools.webSearch()
    }
});
