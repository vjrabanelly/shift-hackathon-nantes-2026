import React from "react";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AnimatedCardContent from "@/components/custom/AnimatedCardContent";
import type {
    SourceVerificationResult,
    WorkflowStatus,
    SourceQualityLevel,
    SourceUsageAssessment
} from "@/lib/types";

const qualityStyles: Record<SourceQualityLevel, string> = {
    high: "bg-green-100 text-green-800",
    medium: "bg-orange-100 text-orange-800",
    low: "bg-red-100 text-red-800"
};

const qualityLabels: Record<SourceQualityLevel, string> = {
    high: "élevée",
    medium: "moyenne",
    low: "faible"
};

const usageStyles: Record<SourceUsageAssessment, string> = {
    correct: "bg-green-100 text-green-800",
    partially_correct: "bg-orange-100 text-orange-800",
    misleading: "bg-red-100 text-red-800",
    unverifiable: "bg-gray-100 text-gray-600"
};

const usageLabels: Record<SourceUsageAssessment, string> = {
    correct: "correct",
    partially_correct: "partiellement correct",
    misleading: "trompeur",
    unverifiable: "invérifiable"
};

const qualityScore: Record<SourceQualityLevel, number> = {
    low: 2,
    medium: 1,
    high: 0
};

const usageScore: Record<SourceUsageAssessment, number> = {
    misleading: 3,
    unverifiable: 2,
    partially_correct: 1,
    correct: 0
};

function sourceScore(s: SourceVerificationResult["sources"][number]): number {
    return (
        usageScore[s.usageAssessment] +
        qualityScore[s.reliability] +
        qualityScore[s.notoriety] +
        s.issues.length
    );
}

const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

function renderWithLinks(text: string) {
    const parts: React.ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    MD_LINK.lastIndex = 0;
    while ((match = MD_LINK.exec(text)) !== null) {
        if (match.index > last) parts.push(text.slice(last, match.index));
        parts.push(
            <a
                key={match.index}
                href={match[2]}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-600 hover:text-blue-800 break-all">
                {match[1]}
            </a>
        );
        last = match.index + match[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
}

export default function SourceVerificationCard({
    result,
    status,
    error
}: {
    result?: SourceVerificationResult;
    status: WorkflowStatus;
    error?: string | null;
}) {
    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-sm font-medium">
                    Vérification des sources
                </CardTitle>
            </CardHeader>
            <CardContent>
                <AnimatedCardContent contentKey={status}>
                    {status === "idle" && (
                        <p className="text-xs text-gray-400">En attente…</p>
                    )}
                    {status === "loading" && (
                        <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-orange-400 animate-pulse" />
                            <p className="text-xs text-gray-400">Chargement…</p>
                        </div>
                    )}
                    {status === "error" && (
                        <p className="text-xs text-red-500">{error}</p>
                    )}
                    {status === "success" && result && (
                        <div className="flex flex-col gap-3">
                            <p className="text-sm text-gray-600 leading-relaxed">
                                {renderWithLinks(result.overallAssessment)}
                            </p>
                            {[...result.sources]
                                .sort((a, b) => sourceScore(b) - sourceScore(a))
                                .slice(0, 3)
                                .map((source, i) => (
                                    <Card
                                        key={i}
                                        className="bg-gray-50 shadow-none">
                                        <CardContent className="flex flex-col gap-3">
                                            <div className="flex items-baseline gap-2 flex-wrap">
                                                <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                                                <span className="text-sm font-medium text-gray-800">
                                                    {source.sourceName}
                                                </span>
                                                <span className="text-xs text-gray-400 italic">
                                                    {source.sourceType}
                                                </span>
                                            </div>
                                            {source.citationExcerpt && (
                                                <div className="rounded bg-white border border-gray-200 px-3 py-2">
                                                    <p className="text-[10px] text-gray-400 font-medium mb-1">
                                                        Extrait de
                                                        l&apos;article
                                                    </p>
                                                    <p className="text-[11px] text-gray-500 italic leading-snug">
                                                        &ldquo;
                                                        {source.citationExcerpt}
                                                        &rdquo;
                                                    </p>
                                                </div>
                                            )}
                                            <div className="flex flex-wrap gap-1.5">
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${qualityStyles[source.notoriety]}`}>
                                                    Notoriété{" "}
                                                    {
                                                        qualityLabels[
                                                            source.notoriety
                                                        ]
                                                    }
                                                </span>
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${qualityStyles[source.reliability]}`}>
                                                    Fiabilité{" "}
                                                    {
                                                        qualityLabels[
                                                            source.reliability
                                                        ]
                                                    }
                                                </span>
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${qualityStyles[source.relevance]}`}>
                                                    Pertinence{" "}
                                                    {
                                                        qualityLabels[
                                                            source.relevance
                                                        ]
                                                    }
                                                </span>
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${usageStyles[source.usageAssessment]}`}>
                                                    Usage{" "}
                                                    {
                                                        usageLabels[
                                                            source
                                                                .usageAssessment
                                                        ]
                                                    }
                                                </span>
                                            </div>
                                            {source.issues.length > 0 && (
                                                <ul className="flex flex-col gap-0.5 pl-1">
                                                    {source.issues.map(
                                                        (issue, j) => (
                                                            <li
                                                                key={j}
                                                                className="text-[11px] text-orange-700 flex gap-1.5 items-baseline">
                                                                <span className="text-orange-400">
                                                                    •
                                                                </span>
                                                                {issue}
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            )}
                                            <p className="text-xs text-gray-500 leading-relaxed">
                                                {renderWithLinks(
                                                    source.assessment
                                                )}
                                            </p>
                                        </CardContent>
                                    </Card>
                                ))}
                        </div>
                    )}
                </AnimatedCardContent>
            </CardContent>
        </Card>
    );
}
