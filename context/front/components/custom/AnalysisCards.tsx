"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import {
    useWorkflowResults,
    type WorkflowResults
} from "@/hooks/useWorkflowResults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EntitiesCard from "@/components/custom/analysis/EntitiesCard";
import SummaryCard from "@/components/custom/analysis/SummaryCard";
import MediaCard from "@/components/custom/analysis/MediaCard";
import OtherMediaCard from "@/components/custom/analysis/OtherMediaCard";
import CognitiveBiasCard from "@/components/custom/analysis/CognitiveBiasCard";
import BlindSpotsCard from "@/components/custom/analysis/BlindSpotsCard";
import SynthesisCard from "@/components/custom/analysis/SynthesisCard";
import SourceVerificationCard from "@/components/custom/analysis/SourceVerificationCard";
import type {
    ArticleData,
    EntitiesResult,
    KeywordsResult,
    SummaryResult,
    MediaResult,
    OtherMediaArticle,
    CognitiveBiasResult,
    BlindSpotsResult,
    SynthesisResult,
    SourceVerificationResult
} from "@/lib/types";

function WorkflowCard({
    title,
    state
}: {
    title: string;
    state: WorkflowResults[keyof WorkflowResults];
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[300px] overflow-y-auto">
                {state.status === "idle" && (
                    <p className="text-xs text-gray-400">En attente…</p>
                )}
                {state.status === "loading" && (
                    <p className="text-xs text-gray-400 animate-pulse">
                        Chargement…
                    </p>
                )}
                {state.status === "error" && (
                    <p className="text-xs text-red-500">{state.error}</p>
                )}
                {state.status === "success" && (
                    <pre className="text-xs whitespace-pre-wrap break-all">
                        {JSON.stringify(state.data, null, 2)}
                    </pre>
                )}
            </CardContent>
        </Card>
    );
}

export default function AnalysisCards({
    articleData,
    articleContent
}: {
    articleData: ArticleData;
    articleContent?: ReactNode;
}) {
    const { results, start } = useWorkflowResults(articleData);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        start();
    }, [start]);

    return (
        <div className="flex flex-col gap-8">
            {/* Article + Synthèse côte à côte */}
            <div className="flex flex-col gap-8 md:flex-row md:gap-12">
                <div className="flex-1 min-w-0">{articleContent}</div>
                <div className="w-full md:w-100 md:shrink-0">
                    <SynthesisCard
                        status={results.synthesis.status}
                        points={
                            (results.synthesis.data as SynthesisResult | null)
                                ?.points
                        }
                        error={results.synthesis.error}
                    />
                </div>
            </div>

            {/* Reste des cards */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                    <Switch
                        id="detail-toggle"
                        checked={showDetails}
                        onCheckedChange={setShowDetails}
                        className="data-[state=checked]:bg-green-500"
                    />
                    <label
                        htmlFor="detail-toggle"
                        className="text-base font-medium text-gray-500 cursor-pointer select-none">
                        {showDetails ? "Analyses détaillées" : "Synthèse"}
                    </label>
                </div>

                {showDetails && (
                    <div className="flex flex-col gap-4">
                        <p className="text-xs text-gray-500">
                            Le modèle utilisé est GPT-5.4 par OpenAI. Les
                            modèles d'AI peuvent parfois générer des résultats
                            inexacts ou incohérents, donc prenez ces analyses
                            comme des indications à vérifier.
                        </p>

                        <SummaryCard
                            status={results.summary.status}
                            summary={
                                (results.summary.data as SummaryResult | null)
                                    ?.summary
                            }
                            keywords={
                                (results.keywords.data as KeywordsResult | null)
                                    ?.keywords
                            }
                            error={results.summary.error}
                        />

                        <MediaCard
                            status={results.media.status}
                            media={
                                (results.media.data as MediaResult | null) ??
                                undefined
                            }
                            error={results.media.error}
                        />

                        <BlindSpotsCard
                            status={results.blindspots.status}
                            blindspots={
                                (
                                    results.blindspots
                                        .data as BlindSpotsResult | null
                                )?.blindspots
                            }
                            error={results.blindspots.error}
                        />
                        <CognitiveBiasCard
                            status={results.cognitiveBias.status}
                            cognitiveBias={
                                (results.cognitiveBias
                                    .data as CognitiveBiasResult | null) ??
                                undefined
                            }
                            error={results.cognitiveBias.error}
                        />

                        <SourceVerificationCard
                            status={results.sourceVerification.status}
                            result={
                                (results.sourceVerification
                                    .data as SourceVerificationResult | null) ??
                                undefined
                            }
                            error={results.sourceVerification.error}
                        />

                        <OtherMediaCard
                            status={results.otherMedia.status}
                            otherMedia={
                                (
                                    results.otherMedia.data as {
                                        otherMedia: OtherMediaArticle[];
                                    } | null
                                )?.otherMedia
                            }
                            error={results.otherMedia.error}
                        />
                        <EntitiesCard
                            status={results.entities.status}
                            entities={
                                (results.entities.data as EntitiesResult | null)
                                    ?.entities
                            }
                            error={results.entities.error}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
