import { z } from "zod";

export const articleSchema = z.object({
    source: z.string(),
    sources: z.array(z.string()).optional(),
    title: z.string(),
    authors: z.array(z.string()),
    sections: z.array(
        z.object({
            heading: z.string().optional(),
            paragraphs: z.array(z.string())
        })
    )
});

export const articleDataSchema = articleSchema.extend({
    url: z.string()
});

export const entitySchema = z.object({
    name: z.string(),
    type: z.enum(["person", "organization"]),
    category: z
        .string()
        .describe(
            "Ex: Personnalité politique, Entreprise tech, Parti politique, Média, Institution, Investisseur, Inconnue…"
        )
});

export const mediaSchema = z.object({
    mediaName: z.string(),
    description: z.string(),
    conflicts: z.array(z.string())
});

export const otherMediaArticleSchema = z.object({
    title: z.string(),
    media: z.string(),
    url: z.string()
});

export const biasFamilyEnum = z.enum([
    "selection_faits",
    "cadrage_lexical",
    "causalite_fragile",
    "usage_chiffres",
    "structure_recit",
    "qualite_argumentative"
]);

export const biasSignalSchema = z.object({
    family: biasFamilyEnum,
    bias: z
        .string()
        .describe(
            "Nom du biais détecté, ex: survivorship, monocausalité, ancrage…"
        ),
    confidence: z.enum(["low", "medium", "high"]),
    excerpt: z
        .string()
        .optional()
        .describe("Extrait de l'article illustrant le biais"),
    explanation: z
        .string()
        .describe("Explication factuelle et constructive du biais détecté")
});

export const cognitiveBiasSchema = z.object({
    signals: z.array(biasSignalSchema),
    globalScore: z
        .number()
        .min(0)
        .max(100)
        .describe(
            "Score de biais global de 0 (aucun biais notable) à 100 (biais majeurs multiples)"
        ),
    summary: z
        .string()
        .describe(
            "Synthèse globale de la qualité argumentative et des principaux biais détectés"
        )
});

export const sourceQualityLevelEnum = z.enum(["low", "medium", "high"]);

export const sourceUsageAssessmentEnum = z.enum([
    "correct",
    "partially_correct",
    "misleading",
    "unverifiable"
]);

export const sourceReferenceSchema = z.object({
    sourceName: z
        .string()
        .describe("Nom de la source citée ou mobilisée dans l'article"),
    sourceType: z
        .string()
        .describe(
            "Ex: étude, institution, expert, média, entreprise, base de données"
        ),
    citationExcerpt: z
        .string()
        .optional()
        .describe(
            "Passage de l'article où la source est mentionnée ou utilisée"
        ),
    notoriety: sourceQualityLevelEnum.describe(
        "Niveau de notoriété publique ou institutionnelle de la source"
    ),
    reliability: sourceQualityLevelEnum.describe(
        "Niveau de fiabilité estimé de la source au vu de sa nature et de sa réputation"
    ),
    relevance: sourceQualityLevelEnum.describe(
        "Pertinence de cette source pour étayer l'affirmation visée dans l'article"
    ),
    usageAssessment: sourceUsageAssessmentEnum.describe(
        "La manière dont l'article utilise la source"
    ),
    issues: z
        .array(z.string())
        .describe(
            "Points de vigilance éventuels : citation tronquée, décontextualisation, ambiguïté, extrapolation, etc."
        ),
    assessment: z
        .string()
        .describe(
            "Analyse synthétique de la qualité de la source et de la justesse de son usage"
        )
});

export const sourceVerificationSchema = z.object({
    sourceCount: z
        .number()
        .int()
        .min(0)
        .describe("Nombre total de sources identifiées dans l'article"),
    overallAssessment: z
        .string()
        .describe(
            "Synthèse globale de la qualité des sources et de leur usage dans l'article"
        ),
    sources: z
        .array(sourceReferenceSchema)
        .describe("Analyse détaillée de chaque source identifiée")
});

export const synthesisPointSchema = z.object({
    label: z.string().describe("Point clé en 12 mots maximum"),
    severity: z
        .enum(["green", "orange", "red"])
        .describe(
            "green = élément positif, orange = risque modéré, red = biais fort ou conflit critique"
        ),
    explanation: z
        .string()
        .describe(
            "Explication en 1-2 phrases pour le lecteur non-expert : pourquoi ce point est important, qu'est-ce que cela signifie concrètement pour la lecture de l'article"
        )
});

export const synthesisResultSchema = z.object({
    points: z
        .array(synthesisPointSchema)
        .max(3)
        .describe(
            "1 à 3 points de synthèse, les plus importants pour le lecteur"
        )
});

export const analysisResultSchema = z.object({
    entities: z.array(entitySchema),
    summary: z.string(),
    keywords: z.array(z.string()),
    blindspots: z.array(z.string()),
    media: mediaSchema,
    otherMedia: z.array(otherMediaArticleSchema),
    cognitiveBias: cognitiveBiasSchema,
    synthesis: synthesisResultSchema.optional()
});

export function articleToText(article: z.infer<typeof articleSchema>): string {
    const parts: string[] = [
        `Titre : ${article.title}`,
        `Auteurs : ${article.authors.join(", ") || "Non précisé"}`,
        `Source : ${article.source}`,
        ""
    ];
    for (const section of article.sections) {
        if (section.heading) parts.push(`## ${section.heading}`);
        parts.push(...section.paragraphs);
        parts.push("");
    }
    return parts.join("\n");
}
