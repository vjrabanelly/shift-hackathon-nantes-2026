"use client";

import { useState } from "react";
import type { ArticleData } from "@/lib/types";
import { Button } from "../ui/button";

export default function ArticleContent({
    article,
    fullPage = false
}: {
    article: ArticleData;
    fullPage?: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const isExpanded = fullPage || expanded;

    return (
        <div className="w-full flex flex-col justify-center">
            <div className="relative">
                <div
                    className={`pr-2 ${
                        fullPage
                            ? ""
                            : `overflow-hidden overflow-y-auto overscroll-contain transition-[max-height] duration-300 ease-in-out ${
                                  isExpanded ? "max-h-[9999px]" : "max-h-[300px]"
                              }`
                    }`}>
                    <p className="mb-4 text-xs text-white/60">
                        {article.source}
                        {article.authors.length > 0 && (
                            <> · {article.authors.join(", ")}</>
                        )}
                    </p>
                    {article.sections.map((section, i) => (
                        <div key={i} className="mb-4">
                            {section.heading && (
                                <h2 className="mb-2 text-sm font-semibold text-white">
                                    {section.heading}
                                </h2>
                            )}
                            {section.paragraphs.map((p, j) => (
                                <p
                                    key={j}
                                    className="mb-3 text-sm leading-7 text-white/88">
                                    {p}
                                </p>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            {!fullPage && (
                <Button
                    onClick={() => setExpanded(!expanded)}
                    className="mt-3 mx-auto border border-white/20 bg-white text-black hover:cursor-pointer hover:bg-white/90">
                    {expanded
                        ? "Réduire l'article ↑"
                        : "Voir l'article en entier ↓"}
                </Button>
            )}
        </div>
    );
}
