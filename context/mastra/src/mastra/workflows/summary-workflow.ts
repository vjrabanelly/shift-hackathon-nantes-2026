import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { articleSchema, articleToText } from "../schemas/article";

const summarizeStep = createStep({
    id: "summarize",
    description: "Produit un résumé de l'article",
    inputSchema: articleSchema,
    outputSchema: z.object({ summary: z.string() }),
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("summaryAgent");
        if (!agent) throw new Error("summaryAgent not found");
        const result = await agent.generate(articleToText(inputData), {
            structuredOutput: {
                schema: z.object({ summary: z.string() })
            }
        });
        return result.object;
    }
});

export const summaryWorkflow = createWorkflow({
    id: "article-summary",
    description: "Produit un résumé d'un article",
    inputSchema: articleSchema,
    outputSchema: z.object({ summary: z.string() })
})
    .then(summarizeStep)
    .commit();
