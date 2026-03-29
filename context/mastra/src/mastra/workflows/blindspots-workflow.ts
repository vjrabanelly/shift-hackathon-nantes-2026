import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { articleSchema, articleToText } from "../schemas/article";

const blindspotsStep = createStep({
    id: "blindspots",
    description: "Identifie les angles manquants de l'article",
    inputSchema: articleSchema,
    outputSchema: z.object({ blindspots: z.array(z.string()) }),
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("blindspotsAgent");
        if (!agent) throw new Error("blindspotsAgent not found");
        const result = await agent.generate(articleToText(inputData), {
            structuredOutput: {
                schema: z.object({ blindspots: z.array(z.string()) })
            }
        });
        return result.object;
    }
});

export const blindspotsWorkflow = createWorkflow({
    id: "blindspots-analysis",
    description: "Identifie les angles manquants d'un article",
    inputSchema: articleSchema,
    outputSchema: z.object({ blindspots: z.array(z.string()) })
})
    .then(blindspotsStep)
    .commit();
