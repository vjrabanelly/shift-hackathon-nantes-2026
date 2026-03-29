import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { articleSchema, articleToText } from "../schemas/article";

const extractKeywordsStep = createStep({
    id: "extract-keywords",
    description: "Extrait les mots-clefs de l'article",
    inputSchema: articleSchema,
    outputSchema: z.object({ keywords: z.array(z.string()) }),
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("keywordsAgent");
        if (!agent) throw new Error("keywordsAgent not found");
        const result = await agent.generate(articleToText(inputData), {
            structuredOutput: {
                schema: z.object({ keywords: z.array(z.string()) })
            }
        });
        return result.object;
    }
});

export const keywordsWorkflow = createWorkflow({
    id: "keywords-extraction",
    description: "Extrait les mots-clefs d'un article",
    inputSchema: articleSchema,
    outputSchema: z.object({ keywords: z.array(z.string()) })
})
    .then(extractKeywordsStep)
    .commit();
