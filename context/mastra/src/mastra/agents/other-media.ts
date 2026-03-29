import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

/** Agent that finds articles on the same topic from other online media */
export const otherMediaAgent = new Agent({
    id: "other-media-agent",
    name: "Other Media Research Agent",
    instructions: `
Tu es un expert en veille médiatique.
On te fournit le titre et le sujet d'un article de presse.
Utilise ton outil de recherche web pour trouver 3 articles traitant du même sujet, publiés par des médias différents.
Pour chaque résultat :
- title : titre de l'article
- media : nom du média
- url : URL directe
Privilégie des angles différents.
    `.trim(),
    model: "openai/gpt-5.4",
    tools: {
        webSearch: openai.tools.webSearch()
    }
});
