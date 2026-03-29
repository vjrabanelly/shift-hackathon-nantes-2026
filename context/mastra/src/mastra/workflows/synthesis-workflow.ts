import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import {
    cognitiveBiasSchema,
    mediaSchema,
    otherMediaArticleSchema,
    sourceVerificationSchema,
    synthesisResultSchema
} from "../schemas/article";

const inputSchema = z.object({
    blindspots: z.array(z.string()),
    cognitiveBias: cognitiveBiasSchema,
    media: mediaSchema,
    otherMedia: z.array(otherMediaArticleSchema),
    sourceVerification: sourceVerificationSchema
});

const synthesisStep = createStep({
    id: "synthesis",
    description: "Synthèse des analyses principales en points clés colorés",
    inputSchema,
    outputSchema: synthesisResultSchema,
    execute: async ({ inputData, mastra }) => {
        const agent = mastra?.getAgent("synthesisAgent");
        if (!agent) throw new Error("synthesisAgent not found");

        const {
            cognitiveBias,
            media,
            blindspots,
            otherMedia,
            sourceVerification
        } = inputData;

        const parts: string[] = [
            "## Biais cognitifs détectés",
            `Score global : ${cognitiveBias.globalScore}/100`,
            `Synthèse : ${cognitiveBias.summary}`,
            ...cognitiveBias.signals.map(
                (s) =>
                    `- ${s.bias} (${s.family}, confiance : ${s.confidence}) : ${s.explanation}`
            ),
            "\n## Angles manquants",
            ...blindspots.map((b) => `- ${b}`),
            "\n## Média source",
            `${media.mediaName} : ${media.description}`,
            ...(media.conflicts.length > 0
                ? [
                      "Conflits d'intérêts :",
                      ...media.conflicts.map((c) => `- ${c}`)
                  ]
                : []),
            "\n## Articles alternatifs trouvés",
            ...otherMedia.map((a) => `- "${a.title}" (${a.media})`),
            "\n## Vérification des sources",
            `Nombre de sources identifiées : ${sourceVerification.sourceCount}`,
            `Bilan global : ${sourceVerification.overallAssessment}`,
            ...sourceVerification.sources.map(
                (s) =>
                    `- ${s.sourceName} (${s.sourceType}) : usage ${s.usageAssessment}, notoriété ${s.notoriety}, fiabilité ${s.reliability}. ${s.assessment}`
            )
        ];

        const result = await agent.generate(parts.join("\n"), {
            structuredOutput: { schema: synthesisResultSchema }
        });
        return result.object;
    }
});

export const synthesisWorkflow = createWorkflow({
    id: "synthesis",
    description: "Synthèse des analyses principales d'un article de presse",
    inputSchema,
    outputSchema: synthesisResultSchema
})
    .then(synthesisStep)
    .commit();
