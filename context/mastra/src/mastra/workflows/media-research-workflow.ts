import { createStep, createWorkflow } from "@mastra/core/workflows";
import { articleSchema, mediaSchema } from "../schemas/article";

const mediaResearchStep = createStep({
    id: "media-research",
    description:
        "Recherche le média source et ses conflits d'intérêts potentiels",
    inputSchema: articleSchema,
    outputSchema: mediaSchema,
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("mediaAgent");
        if (!agent) throw new Error("mediaAgent not found");
        const prompt = `Média : "${inputData.source}"\nSujet de l'article : "${inputData.title}"\n\nRecherche ce média, son propriétaire et ses actionnaires, et identifie les conflits d'intérêts potentiels avec le sujet traité.`;
        const result = await agent.generate(prompt, {
            structuredOutput: { schema: mediaSchema }
        });
        return result.object;
    }
});

export const mediaResearchWorkflow = createWorkflow({
    id: "media-research",
    description:
        "Recherche le média source et ses conflits d'intérêts potentiels",
    inputSchema: articleSchema,
    outputSchema: mediaSchema
})
    .then(mediaResearchStep)
    .commit();
