"use client";

import { useArticleExtraction } from "@/hooks/useArticleExtraction";
import { Card, CardContent } from "@/components/ui/card";
import ArticleContent from "@/components/custom/ArticleContent";
import AnalysisCardsLoader from "@/components/custom/AnalysisCardsLoader";

function Skeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div className="h-6 w-2/3 rounded bg-gray-200 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="rounded-xl border bg-card animate-pulse h-32"
                    />
                ))}
            </div>
        </div>
    );
}

export default function UrlAnalysisCards({ url }: { url: string }) {
    const { status, data, error } = useArticleExtraction(url);

    if (status === "idle" || status === "loading") {
        return <Skeleton />;
    }

    if (status === "error") {
        return (
            <Card>
                <CardContent className="pt-6">
                    <p className="text-sm text-red-500">{error}</p>
                </CardContent>
            </Card>
        );
    }

    if (!data) return null;

    return (
        <AnalysisCardsLoader
            articleData={data}
            articleContent={<ArticleContent article={data} />}
        />
    );
}
