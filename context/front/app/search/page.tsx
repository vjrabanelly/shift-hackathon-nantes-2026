"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, X } from "lucide-react";
import { inputExample } from "@/lib/input-example";

export default function SearchPage() {
    const router = useRouter();
    const [value, setValue] = useState("");

    const navigateTo = (url: string) => {
        router.push(`/results?url=${encodeURIComponent(url)}`);
    };

    const canSubmit = value.trim().length > 0;

    return (
        <main className="relative min-h-[100dvh] bg-black">
            <video
                autoPlay
                muted
                loop
                playsInline
                className="fixed top-0 left-1/2 h-[100dvh] w-auto max-w-none -translate-x-1/2 object-contain object-center sm:h-screen"
                src="/video-accueil-v02.mp4"
            />

            <section className="relative z-10 min-h-[100dvh]">
                <div className="flex min-h-[100dvh] flex-col justify-end px-4 py-4 sm:px-6 sm:py-6">
                    <div className="mx-auto w-full max-w-6xl">
                        <div className="blindspot-search-bar blindspot-glass-panel mx-auto w-full max-w-4xl bg-white/92 shadow-[0_18px_50px_rgba(0,0,0,0.2)] backdrop-blur-md">
                            <Search className="ml-2 h-5 w-5 shrink-0 text-black/45" />
                            <input
                                type="url"
                                value={value}
                                onChange={(event) => setValue(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && canSubmit) {
                                        navigateTo(value.trim());
                                    }
                                }}
                                placeholder="Colle ici un article, une video ou une URL de news"
                                className="blindspot-search-input"
                            />
                            {canSubmit && (
                                <button
                                    type="button"
                                    onClick={() => setValue("")}
                                    aria-label="Effacer l'URL"
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-black/55 transition hover:bg-black/5 hover:text-black">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                            <button
                                type="button"
                                className="blindspot-search-submit"
                                onClick={() => navigateTo(value.trim())}
                                disabled={!canSubmit}
                                aria-label="Lancer l'analyse">
                                <ArrowRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-4 pb-4 pt-4 sm:px-6 sm:py-6">
                    <div className="mx-auto w-full max-w-6xl">
                        <div className="blindspot-glass-panel rounded-[2rem] bg-white/88 p-5 sm:p-6">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-black/50">
                                        Exemples
                                    </p>
                                    <p className="mt-1 text-sm text-black/65">
                                        Utilise un article de demo pour ouvrir
                                        directement l&apos;experience.
                                    </p>
                                </div>
                            </div>

                            <div className="blindspot-example-grid">
                                {inputExample.map((article) => (
                                    <button
                                        key={article.url}
                                        type="button"
                                        onClick={() => navigateTo(article.url)}
                                        className="blindspot-example-card blindspot-glass-panel">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/45">
                                            {article.source}
                                        </p>
                                        <h2 className="mt-3 text-left text-lg font-semibold leading-snug text-black">
                                            {article.title}
                                        </h2>
                                        <p className="mt-4 text-sm leading-6 text-black/65">
                                            {article.authors.join(", ") || "Article exemple"}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
