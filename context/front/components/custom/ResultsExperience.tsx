"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { useArticleExtraction } from "@/hooks/useArticleExtraction";
import { useWorkflowResults } from "@/hooks/useWorkflowResults";
import type {
    ArticleData,
    BlindSpotsResult,
    CognitiveBiasResult,
    EntitiesResult,
    KeywordsResult,
    MediaResult,
    OtherMediaArticle,
    SourceVerificationResult,
    SummaryResult,
    SynthesisResult
} from "@/lib/types";
import ArticleContent from "@/components/custom/ArticleContent";
import SummaryCard from "@/components/custom/analysis/SummaryCard";
import BlindSpotsCard from "@/components/custom/analysis/BlindSpotsCard";
import CognitiveBiasCard from "@/components/custom/analysis/CognitiveBiasCard";
import MediaCard from "@/components/custom/analysis/MediaCard";
import OtherMediaCard from "@/components/custom/analysis/OtherMediaCard";
import EntitiesCard from "@/components/custom/analysis/EntitiesCard";
import SynthesisCard from "@/components/custom/analysis/SynthesisCard";
import SourceVerificationCard from "@/components/custom/analysis/SourceVerificationCard";

type OrbId =
    | "article"
    | "blindspots"
    | "bias"
    | "media"
    | "sources"
    | "other-media"
    | "entities";

type OrbDefinition = {
    id: OrbId;
    title: string;
    meta: string;
};

const ORBS: OrbDefinition[] = [
    { id: "article", title: "Article\nsource", meta: "Texte original" },
    {
        id: "blindspots",
        title: "Angles\nmanquant",
        meta: "Ce qu'on ne vous dit pas"
    },
    { id: "bias", title: "Biais\ncognitifs", meta: "Signaux d'intension" },
    { id: "media", title: "Analyse du\nmedia", meta: "Contexte editorial" },
    {
        id: "sources",
        title: "Verification\ndes sources",
        meta: "Validite des preuves"
    },
    {
        id: "other-media",
        title: "Aller plus\nloin",
        meta: "Points de vue"
    },
    {
        id: "entities",
        title: "Personnes\nmentionnees",
        meta: "Acteurs cites"
    }
];

function LoadingState({ label }: { label: string }) {
    return (
        <div className="blindspot-modal-card">
            <p className="text-sm">{label}</p>
        </div>
    );
}

function SummaryHero({
    results
}: {
    results: ReturnType<typeof useWorkflowResults>["results"];
}) {
    return (
        <div className="grid gap-4 pb-6">
            <div className="blindspot-glass-panel rounded-[2rem] p-4">
                <SynthesisCard
                    status={results.synthesis.status}
                    points={
                        (results.synthesis.data as SynthesisResult | null)?.points
                    }
                    error={results.synthesis.error}
                />
            </div>
            <div className="blindspot-glass-panel rounded-[2rem] p-4">
                <SummaryCard
                    status={results.summary.status}
                    summary={
                        (results.summary.data as SummaryResult | null)?.summary
                    }
                    keywords={
                        (results.keywords.data as KeywordsResult | null)?.keywords
                    }
                    error={results.summary.error}
                />
            </div>
        </div>
    );
}

function hasCriticalSignal(orbId: OrbId, results: ReturnType<typeof useWorkflowResults>["results"]) {
    switch (orbId) {
        case "article":
        case "other-media":
        case "entities":
            return false;
        case "blindspots": {
            if (results.blindspots.status !== "success") return false;
            const blindspots =
                (results.blindspots.data as BlindSpotsResult | null)?.blindspots ?? [];
            return blindspots.length >= 3;
        }
        case "bias": {
            if (results.cognitiveBias.status !== "success") return false;
            const bias = results.cognitiveBias.data as CognitiveBiasResult | null;
            if (!bias) return false;

            return (
                bias.globalScore >= 60 ||
                bias.signals.some((signal) => signal.confidence === "high")
            );
        }
        case "media": {
            if (results.media.status !== "success") return false;
            const media = results.media.data as MediaResult | null;
            if (!media) return false;

            return media.conflicts.some((conflict) =>
                /conflit|vigilance|risque|biais|interets/i.test(conflict)
            );
        }
        case "sources": {
            if (results.sourceVerification.status !== "success") return false;
            const sourceVerification =
                results.sourceVerification.data as SourceVerificationResult | null;
            if (!sourceVerification) return false;

            return sourceVerification.sources.some(
                (source) =>
                    source.usageAssessment === "misleading" ||
                    source.usageAssessment === "unverifiable" ||
                    source.issues.length > 0
            );
        }
    }
}

function ResultsScene({
    title,
    subtitle,
    children
}: {
    title: string;
    subtitle: string;
    children: ReactNode;
}) {
    return (
        <div className="blindspot-results-page">
            <video
                autoPlay
                muted
                loop
                playsInline
                className="blindspot-video"
                src="/bg-b-01.mp4"
            />
            <div className="blindspot-results-video-mask" />
            <div className="blindspot-results-hero">
                <Image
                    src="/logo-titre.png"
                    alt="BlindSpot"
                    width={1440}
                    height={390}
                    className="blindspot-results-hero-image"
                    priority
                />
            </div>
            <div className="blindspot-results-layout">
                <div className="blindspot-results-header">
                    <div className="blindspot-glass-panel blindspot-results-status">
                        <p className="font-semibold text-black">{title}</p>
                        <p className="mt-1 text-sm text-black/65">{subtitle}</p>
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
}

function ResultsLoadedView({
    articleData,
    pageTitle
}: {
    articleData: ArticleData;
    pageTitle?: string;
}) {
    const { results, start } = useWorkflowResults(articleData);
    const [activeOrb, setActiveOrb] = useState<OrbId | null>(null);
    const [visibleOrb, setVisibleOrb] = useState<OrbId | null>(null);
    const [overlayOpen, setOverlayOpen] = useState(false);
    const [expanderStyle, setExpanderStyle] = useState<CSSProperties>({});
    const [expanderVisible, setExpanderVisible] = useState(false);
    const [expanderScale, setExpanderScale] = useState(0);
    const openTimeoutRef = useRef<number | null>(null);
    const closeTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        start();
    }, [start]);

    useEffect(() => {
        return () => {
            if (openTimeoutRef.current) window.clearTimeout(openTimeoutRef.current);
            if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (!overlayOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [overlayOpen]);

    const articleTitle = pageTitle ?? articleData.title;
    const orbStates = useMemo(
        () =>
            Object.fromEntries(
                ORBS.map((orb) => [
                    orb.id,
                    {
                        critical: hasCriticalSignal(orb.id, results)
                    }
                ])
            ) as Record<OrbId, { critical: boolean }>,
        [results]
    );

    const modalContent = useMemo(() => {
        if (!visibleOrb) return null;

        switch (visibleOrb) {
            case "article":
                return (
                    <div className="blindspot-modal-card">
                        <ArticleContent article={articleData} fullPage />
                    </div>
                );
            case "blindspots":
                return (
                    <div className="blindspot-modal-card">
                        <BlindSpotsCard
                            status={results.blindspots.status}
                            blindspots={
                                (results.blindspots.data as BlindSpotsResult | null)
                                    ?.blindspots
                            }
                            error={results.blindspots.error}
                        />
                    </div>
                );
            case "bias":
                return (
                    <div className="blindspot-modal-card">
                        <CognitiveBiasCard
                            status={results.cognitiveBias.status}
                            cognitiveBias={
                                (results.cognitiveBias
                                    .data as CognitiveBiasResult | null) ?? undefined
                            }
                            error={results.cognitiveBias.error}
                        />
                    </div>
                );
            case "media":
                return (
                    <div className="blindspot-modal-card">
                        <MediaCard
                            status={results.media.status}
                            media={
                                (results.media.data as MediaResult | null) ?? undefined
                            }
                            error={results.media.error}
                        />
                    </div>
                );
            case "sources":
                return (
                    <div className="blindspot-modal-card">
                        <SourceVerificationCard
                            status={results.sourceVerification.status}
                            result={
                                (results.sourceVerification
                                    .data as SourceVerificationResult | null) ??
                                undefined
                            }
                            error={results.sourceVerification.error}
                        />
                    </div>
                );
            case "other-media":
                return (
                    <div className="blindspot-modal-card">
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
                    </div>
                );
            case "entities":
                return (
                    <div className="blindspot-modal-card">
                        <EntitiesCard
                            status={results.entities.status}
                            entities={
                                (results.entities.data as EntitiesResult | null)
                                    ?.entities
                            }
                            error={results.entities.error}
                        />
                    </div>
                );
        }
    }, [articleData, results, visibleOrb]);

    const handleOpen = (
        orbId: OrbId,
        event: MouseEvent<HTMLButtonElement>
    ) => {
        if (openTimeoutRef.current) window.clearTimeout(openTimeoutRef.current);
        if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current);

        const rect = event.currentTarget.getBoundingClientRect();
        const scaleX = (window.innerWidth * 1.25) / rect.width;
        const scaleY = (window.innerHeight * 1.25) / rect.height;
        const scale = Math.max(scaleX, scaleY) * 1.25;

        setActiveOrb(orbId);
        setVisibleOrb(null);
        setOverlayOpen(false);
        setExpanderStyle({
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left
        });
        setExpanderScale(1);
        setExpanderVisible(true);

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                setExpanderScale(scale);
                openTimeoutRef.current = window.setTimeout(() => {
                    setVisibleOrb(orbId);
                    setOverlayOpen(true);
                }, 320);
            });
        });
    };

    const handleClose = () => {
        setOverlayOpen(false);
        closeTimeoutRef.current = window.setTimeout(() => {
            setVisibleOrb(null);
            setActiveOrb(null);
            setExpanderScale(0);
            closeTimeoutRef.current = window.setTimeout(() => {
                setExpanderVisible(false);
            }, 360);
        }, 180);
    };

    return (
        <>
            {expanderVisible && (
                <div
                    className="blindspot-expander"
                    style={{
                        ...expanderStyle,
                        opacity: 1,
                        transform: `scale(${expanderScale})`
                    }}
                />
            )}

            <div
                className={`blindspot-modal ${overlayOpen ? "blindspot-modal-open" : ""}`}
                aria-hidden={!overlayOpen}>
                {visibleOrb && (
                    <div className="blindspot-modal-content">
                        <div className="flex justify-end pb-4">
                            <button
                                type="button"
                                className="blindspot-modal-close"
                                onClick={handleClose}
                                aria-label="Fermer le detail">
                                <X className="h-7 w-7" />
                            </button>
                        </div>
                        <div>
                            <button
                                type="button"
                                className="blindspot-modal-heading"
                                onClick={handleClose}
                                aria-label="Retour aux resultats">
                                <div className="blindspot-modal-dot" />
                                <div className="blindspot-modal-title">
                                    {ORBS.find((orb) => orb.id === visibleOrb)?.title
                                        .split("\n")
                                        .map((line) => (
                                            <div key={line}>{line}</div>
                                        ))}
                                </div>
                            </button>
                            {modalContent}
                            <div className="mt-8 flex justify-center pb-4">
                                <button
                                    type="button"
                                    className="blindspot-results-back"
                                    onClick={handleClose}>
                                    Retour aux resultats
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <ResultsScene title={articleTitle} subtitle={articleData.source}>
                <SummaryHero results={results} />
                <div className="blindspot-results-grid">
                    {ORBS.map((orb) => (
                        <div key={orb.id} className="blindspot-orb-wrap">
                            <button
                                type="button"
                                className={`blindspot-orb ${orbStates[orb.id].critical ? "blindspot-orb-highlight" : ""}`}
                                onClick={(event) => handleOpen(orb.id, event)}
                                aria-pressed={activeOrb === orb.id}>
                                <span className="blindspot-orb-label">
                                    {orb.title.split("\n").map((line) => (
                                        <span key={line} className="block">
                                            {line}
                                        </span>
                                    ))}
                                </span>
                                <span className="blindspot-orb-meta">{orb.meta}</span>
                            </button>
                        </div>
                    ))}
                </div>
            </ResultsScene>
        </>
    );
}

function ExtractedResultsView({
    url,
    title
}: {
    url: string;
    title?: string;
}) {
    const { status, data, error } = useArticleExtraction(url);

    if (status === "success" && data) {
        return <ResultsLoadedView articleData={data} pageTitle={title} />;
    }

    return (
        <ResultsScene
            title={title ?? "Preparation de l'analyse"}
            subtitle={
                status === "loading" || status === "idle"
                    ? "Extraction de l'article et construction du contexte..."
                    : error ?? "Impossible de recuperer cet article pour le moment."
            }>
            <div className="grid gap-4 pb-6">
                <div className="blindspot-glass-panel rounded-[2rem] p-4">
                    <SynthesisCard status="loading" />
                </div>
                <div className="blindspot-glass-panel rounded-[2rem] p-4">
                    <SummaryCard status="loading" />
                </div>
            </div>
            <div className="blindspot-results-grid">
                {ORBS.map((orb) => (
                    <div key={orb.id} className="blindspot-orb-wrap">
                        <button
                            type="button"
                            className="blindspot-orb"
                            disabled>
                            <span className="blindspot-orb-label">
                                {orb.title.split("\n").map((line) => (
                                    <span key={line} className="block">
                                        {line}
                                    </span>
                                ))}
                            </span>
                            <span className="blindspot-orb-meta">
                                {status === "error" ? "Indisponible" : "Preparation"}
                            </span>
                        </button>
                    </div>
                ))}
            </div>

            <div className="mt-4">
                <LoadingState
                    label={
                        status === "error"
                            ? error ??
                              "Impossible de recuperer cet article pour le moment."
                            : "On recupere le contenu de l'article puis on remplit les pastilles d'analyse."
                    }
                />
            </div>
        </ResultsScene>
    );
}

export default function ResultsExperience({
    url,
    title,
    exampleArticle
}: {
    url: string;
    title?: string;
    exampleArticle?: ArticleData;
}) {
    if (exampleArticle) {
        return <ResultsLoadedView articleData={exampleArticle} pageTitle={title} />;
    }

    return <ExtractedResultsView url={url} title={title} />;
}
