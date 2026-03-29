import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import {
    articleSchema,
    articleToText,
    cognitiveBiasSchema
} from "../schemas/article";

const cognitiveBiasStep = createStep({
    id: "cognitive-bias",
    description: "Détecte les biais cognitifs présents dans l'article",
    inputSchema: articleSchema,
    outputSchema: cognitiveBiasSchema,
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("cognitiveBiasAgent");
        if (!agent) throw new Error("cognitiveBiasAgent not found");
        const result = await agent.generate(articleToText(inputData), {
            structuredOutput: { schema: cognitiveBiasSchema }
        });
        return result.object;
    }
});

export const cognitiveBiasWorkflow = createWorkflow({
    id: "cognitive-bias-analysis",
    description: "Détecte les biais cognitifs d'un article de presse",
    inputSchema: articleSchema,
    outputSchema: cognitiveBiasSchema
})
    .then(cognitiveBiasStep)
    .commit();
