import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import {
    Observability,
    DefaultExporter,
    CloudExporter,
    SensitiveDataFilter
} from "@mastra/observability";
import { weatherWorkflow } from "./workflows/example-weather-workflow";
import { fullArticleAnalysisWorkflow } from "./workflows/full-article-analysis-workflow";
import { entitiesWorkflow } from "./workflows/entities-workflow";
import { summaryWorkflow } from "./workflows/summary-workflow";
import { keywordsWorkflow } from "./workflows/keywords-workflow";
import { blindspotsWorkflow } from "./workflows/blindspots-workflow";
import { mediaResearchWorkflow } from "./workflows/media-research-workflow";
import { otherMediaWorkflow } from "./workflows/other-media-workflow";
import { cognitiveBiasWorkflow } from "./workflows/cognitive-bias-workflow";
import { articleExtractorWorkflow } from "./workflows/article-extractor-workflow";
import { synthesisWorkflow } from "./workflows/synthesis-workflow";
import { sourceVerificationWorkflow } from "./workflows/source-verification-workflow";
import { weatherAgent } from "./agents/example-weather-agent";
import { articleAgent } from "./agents/article-agent";
import { entityAgent } from "./agents/entity-agent";
import { summaryAgent } from "./agents/summary-agent";
import { keywordsAgent } from "./agents/keywords-agent";
import { blindspotsAgent } from "./agents/blindspots-agent";
import { mediaAgent } from "./agents/media-agent";
import { otherMediaAgent } from "./agents/other-media";
import { cognitiveBiasAgent } from "./agents/cognitive-bias-agent";
import { articleStructurerAgent } from "./agents/article-structurer-agent";
import { synthesisAgent } from "./agents/synthesis-agent";
import { sourceVerificationAgent } from "./agents/source-verification-agent";
import {
    toolCallAppropriatenessScorer,
    completenessScorer,
    translationScorer
} from "./scorers/example-weather-scorer";

export const mastra = new Mastra({
    workflows: {
        weatherWorkflow,
        fullArticleAnalysisWorkflow,
        entitiesWorkflow,
        summaryWorkflow,
        keywordsWorkflow,
        blindspotsWorkflow,
        mediaResearchWorkflow,
        otherMediaWorkflow,
        cognitiveBiasWorkflow,
        articleExtractorWorkflow,
        synthesisWorkflow,
        sourceVerificationWorkflow
    },
    agents: {
        weatherAgent,
        articleAgent,
        entityAgent,
        summaryAgent,
        keywordsAgent,
        blindspotsAgent,
        mediaAgent,
        otherMediaAgent,
        cognitiveBiasAgent,
        articleStructurerAgent,
        synthesisAgent,
        sourceVerificationAgent
    },
    scorers: {
        toolCallAppropriatenessScorer,
        completenessScorer,
        translationScorer
    },
    storage: new LibSQLStore({
        id: "mastra-storage",
        // stores observability, scores, ... into persistent file storage
        // Prod: fichier dans le volume Docker /data
        // Dev: fichier relatif au CWD du process (racine du package mastra/)
        url:
            process.env.NODE_ENV === "production"
                ? "file:/data/mastra.db"
                : "file:./mastra.db"
    }),
    logger: new PinoLogger({
        name: "Mastra",
        level: "info"
    }),
    observability: new Observability({
        configs: {
            default: {
                serviceName: "mastra",
                exporters: [
                    new DefaultExporter(), // Persists traces to storage for Mastra Studio
                    new CloudExporter() // Sends traces to Mastra Cloud (if MASTRA_CLOUD_ACCESS_TOKEN is set)
                ],
                spanOutputProcessors: [
                    new SensitiveDataFilter() // Redacts sensitive data like passwords, tokens, keys
                ]
            }
        }
    })
});
