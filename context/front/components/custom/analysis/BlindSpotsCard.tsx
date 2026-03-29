import { Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AnimatedCardContent from "@/components/custom/AnimatedCardContent";

export default function BlindSpotsCard({
    blindspots,
    status,
    error
}: {
    blindspots?: string[];
    status: "idle" | "loading" | "success" | "error";
    error?: string | null;
}) {
    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-sm font-medium">
                    Angles manquants
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
                    {status === "success" && blindspots && (
                        <ul className="space-y-4">
                            {blindspots.map((spot, i) => (
                                <li
                                    key={i}
                                    className="flex gap-4 text-sm text-gray-700">
                                    <Eye className="w-3.5 h-3.5 shrink-0 mt-3 text-gray-400" />
                                    <span>{spot}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </AnimatedCardContent>
            </CardContent>
        </Card>
    );
}
