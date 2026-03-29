import { Agent } from "@mastra/core/agent";

export const summaryAgent = new Agent({
    id: "summary-agent",
    name: "Summary Agent",
    instructions: `
Tu es un expert en résumé journalistique.
On te fournit le texte brut d'un article de presse.
Rédige un résumé factuel et neutre en 2 phrases maximum en français : sujet principal, acteurs clés, enjeu central.
    `.trim(),
    model: "openai/gpt-5.4"
});
