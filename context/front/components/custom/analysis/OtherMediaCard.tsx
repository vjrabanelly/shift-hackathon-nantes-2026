import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OtherMediaArticle } from "@/lib/types";
import AnimatedCardContent from "@/components/custom/AnimatedCardContent";

export default function OtherMediaCard({
    otherMedia,
    status,
    error
}: {
    otherMedia?: OtherMediaArticle[];
    status: "idle" | "loading" | "success" | "error";
    error?: string | null;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">
                    Aller plus loin sur le sujet
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
                    {status === "success" && otherMedia && (
                        <ul className="space-y-3">
                            {otherMedia.map((item) => (
                                <li key={item.url}>
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-start gap-2 group">
                                        <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                        <span>
                                            <span className="text-xs font-medium text-gray-800 group-hover:text-blue-600 group-hover:underline transition-colors leading-snug block">
                                                {item.title}
                                            </span>
                                            <span className="text-xs text-gray-400 mt-0.5 block">
                                                {item.media}
                                            </span>
                                        </span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}
                </AnimatedCardContent>
            </CardContent>
        </Card>
    );
}
