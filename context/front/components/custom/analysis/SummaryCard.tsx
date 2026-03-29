import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AnimatedCardContent from "@/components/custom/AnimatedCardContent";

export default function SummaryCard({
    summary,
    keywords,
    status,
    error
}: {
    summary?: string;
    keywords?: string[];
    status: "idle" | "loading" | "success" | "error";
    error?: string | null;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">
                    Résumé de l'article
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
                    {status === "success" && summary && (
                        <p className="text-sm text-gray-700 leading-relaxed">
                            {summary}
                        </p>
                    )}
                    {keywords && keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-4">
                            {keywords.map((kw) => (
                                <span
                                    key={kw}
                                    className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm text-gray-600">
                                    {kw}
                                </span>
                            ))}
                        </div>
                    )}
                </AnimatedCardContent>
            </CardContent>
        </Card>
    );
}
