"use client";

import dynamic from "next/dynamic";
import type { ArticleData } from "@/lib/types";
import type React from "react";

const AnalysisCards = dynamic(
    () => import("@/components/custom/AnalysisCards"),
    {
        ssr: false,
        loading: () => (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="rounded-xl border bg-card animate-pulse h-32"
                    />
                ))}
            </div>
        )
    }
);

export default function AnalysisCardsLoader({
    articleData,
    articleContent
}: {
    articleData: ArticleData;
    articleContent?: React.ReactNode;
}) {
    return (
        <AnalysisCards
            articleData={articleData}
            articleContent={articleContent}
        />
    );
}
