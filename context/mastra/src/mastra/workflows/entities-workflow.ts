import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { articleSchema, entitySchema, articleToText } from "../schemas/article";

const extractEntitiesStep = createStep({
    id: "extract-entities",
    description:
        "Extrait les personnes et organisations mentionnées dans l'article",
    inputSchema: articleSchema,
    outputSchema: z.object({ entities: z.array(entitySchema) }),
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("entityAgent");
        if (!agent) throw new Error("entityAgent not found");
        const result = await agent.generate(articleToText(inputData), {
            structuredOutput: {
                schema: z.object({ entities: z.array(entitySchema) })
            }
        });
        return result.object;
    }
});

export const entitiesWorkflow = createWorkflow({
    id: "entities-analysis",
    description: "Extrait les entités nommées d'un article",
    inputSchema: articleSchema,
    outputSchema: z.object({ entities: z.array(entitySchema) })
})
    .then(extractEntitiesStep)
    .commit();
