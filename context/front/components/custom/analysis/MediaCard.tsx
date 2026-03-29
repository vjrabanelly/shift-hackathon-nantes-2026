import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MediaResult } from "@/lib/types";
import AnimatedCardContent from "@/components/custom/AnimatedCardContent";

/**
 * Renders text with markdown links and newline-separated paragraphs.
 * Handles both `[text](url)` and `([text](url))` formats.
 */
function RichText({ text }: { text: string }) {
    // Matches optional outer parens: ([text](url)) or [text](url)
    const linkRegex = /\(?\[([^\]]+)\]\(([^)]+)\)\)?/g;
    const paragraphs = text.split(/\n+/).filter(Boolean);

    return (
        <div className="space-y-2">
            {paragraphs.map((para, pIdx) => {
                const nodes: React.ReactNode[] = [];
                let lastIndex = 0;
                linkRegex.lastIndex = 0;
                let match: RegExpExecArray | null;

                while ((match = linkRegex.exec(para)) !== null) {
                    if (match.index > lastIndex) {
                        nodes.push(para.slice(lastIndex, match.index));
                    }
                    nodes.push(
                        <a
                            key={match.index}
                            href={match[2]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline">
                            {match[1]}
                        </a>
                    );
                    lastIndex = match.index + match[0].length;
                }

                if (lastIndex < para.length) {
                    nodes.push(para.slice(lastIndex));
                }

                return (
                    <p
                        key={pIdx}
                        className="text-xs text-gray-600 leading-relaxed">
                        {nodes}
                    </p>
                );
            })}
        </div>
    );
}

export default function MediaCard({
    media,
    status,
    error
}: {
    media?: MediaResult;
    status: "idle" | "loading" | "success" | "error";
    error?: string | null;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">
                    Analyse du média
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
                    {status === "success" && media && (
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-gray-800">
                                {media.mediaName}
                            </p>
                            {media.conflicts.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                    {media.conflicts.map((c, i) => (
                                        <div
                                            key={i}
                                            className="flex gap-2 text-xs text-orange-700 bg-orange-50 rounded-md px-2 py-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                            <span>{c}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <RichText text={media.description} />
                        </div>
                    )}
                </AnimatedCardContent>
            </CardContent>
        </Card>
    );
}
