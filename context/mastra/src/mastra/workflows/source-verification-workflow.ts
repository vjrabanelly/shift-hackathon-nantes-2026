import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import {
    articleSchema,
    articleToText,
    sourceReferenceSchema,
    sourceVerificationSchema
} from "../schemas/article";

const sourceVerificationGenerationSchema = z.object({
    overallAssessment: z.string(),
    sources: z.array(sourceReferenceSchema)
});

const sourceVerificationStep = createStep({
    id: "source-verification",
    description:
        "Identifie les sources mobilisées dans un article et évalue leur qualité et la justesse de leur usage",
    inputSchema: articleSchema,
    outputSchema: sourceVerificationSchema,
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("sourceVerificationAgent");
        if (!agent) throw new Error("sourceVerificationAgent not found");

        const prompt = `
Analyse cet article de presse et dresse un audit des sources qu'il mobilise.

Objectifs :
1. Identifier les sources explicites ou clairement mobilisées dans le texte
2. Evaluer leur notoriété et leur fiabilité
3. Evaluer si leur utilisation dans l'article est pertinente et correcte
4. Signaler les usages potentiellement tronqués, décontextualisés, détournés ou invérifiables

Article :
${articleToText(inputData)}
        `.trim();

        const result = await agent.generate(prompt, {
            structuredOutput: { schema: sourceVerificationGenerationSchema }
        });

        return {
            sourceCount: result.object.sources.length,
            overallAssessment: result.object.overallAssessment,
            sources: result.object.sources
        };
    }
});

export const sourceVerificationWorkflow = createWorkflow({
    id: "source-verification",
    description:
        "Vérifie les sources citées dans un article, leur qualité et la justesse de leur usage",
    inputSchema: articleSchema,
    outputSchema: sourceVerificationSchema
})
    .then(sourceVerificationStep)
    .commit();
