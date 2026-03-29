import { Agent } from "@mastra/core/agent";

export const keywordsAgent = new Agent({
    id: "keywords-agent",
    name: "Keywords Extraction Agent",
    instructions: `
Tu es un expert en indexation de contenu journalistique.
On te fournit le texte brut d'un article de presse.
Extrais 5 mots-clefs maximum, spécifiques et informatifs (noms propres, concepts, secteurs). Pas de termes génériques.
    `.trim(),
    model: "openai/gpt-5.4"
});
