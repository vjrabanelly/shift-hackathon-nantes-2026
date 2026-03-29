import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { articleSchema, otherMediaArticleSchema } from "../schemas/article";

const otherMediaStep = createStep({
    id: "other-media",
    description:
        "Recherche des articles sur le même sujet dans d'autres médias",
    inputSchema: articleSchema,
    outputSchema: z.object({ otherMedia: z.array(otherMediaArticleSchema) }),
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("otherMediaAgent");
        if (!agent) throw new Error("otherMediaAgent not found");
        const prompt = `Sujet : "${inputData.title}"\n\nRecherche des articles en ligne traitant du même sujet, publiés par des médias différents de "${inputData.source}".`;
        const result = await agent.generate(prompt, {
            structuredOutput: {
                schema: z.object({
                    otherMedia: z.array(otherMediaArticleSchema)
                })
            }
        });
        return result.object;
    }
});

export const otherMediaWorkflow = createWorkflow({
    id: "other-media",
    description:
        "Recherche des articles sur le même sujet dans d'autres médias",
    inputSchema: articleSchema,
    outputSchema: z.object({ otherMedia: z.array(otherMediaArticleSchema) })
})
    .then(otherMediaStep)
    .commit();
