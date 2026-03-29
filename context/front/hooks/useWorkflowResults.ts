import { useReducer, useCallback, useRef, useEffect } from "react";
import type {
    ArticleData,
    WorkflowState,
    KeywordsResult,
    SummaryResult,
    EntitiesResult,
    BlindSpotsResult,
    MediaResult,
    OtherMediaResult,
    CognitiveBiasResult,
    SynthesisResult,
    OtherMediaArticle,
    SourceVerificationResult
} from "@/lib/types";

export interface WorkflowResults {
    keywords: WorkflowState<KeywordsResult>;
    summary: WorkflowState<SummaryResult>;
    entities: WorkflowState<EntitiesResult>;
    blindspots: WorkflowState<BlindSpotsResult>;
    media: WorkflowState<MediaResult>;
    otherMedia: WorkflowState<OtherMediaResult>;
    cognitiveBias: WorkflowState<CognitiveBiasResult>;
    synthesis: WorkflowState<SynthesisResult>;
    sourceVerification: WorkflowState<SourceVerificationResult>;
}

type WorkflowKey = keyof WorkflowResults;

type Action =
    | { type: "LOADING"; workflow: WorkflowKey }
    | { type: "SUCCESS"; workflow: WorkflowKey; data: unknown }
    | { type: "ERROR"; workflow: WorkflowKey; error: string };

function makeIdle(): WorkflowState<never> {
    return { status: "idle", data: null, error: null };
}

const initialState: WorkflowResults = {
    keywords: makeIdle(),
    summary: makeIdle(),
    entities: makeIdle(),
    blindspots: makeIdle(),
    media: makeIdle(),
    otherMedia: makeIdle(),
    cognitiveBias: makeIdle(),
    synthesis: makeIdle(),
    sourceVerification: makeIdle()
};

function reducer(state: WorkflowResults, action: Action): WorkflowResults {
    switch (action.type) {
        case "LOADING":
            return {
                ...state,
                [action.workflow]: {
                    status: "loading",
                    data: null,
                    error: null
                }
            };
        case "SUCCESS":
            return {
                ...state,
                [action.workflow]: {
                    status: "success",
                    data: action.data,
                    error: null
                }
            };
        case "ERROR":
            return {
                ...state,
                [action.workflow]: {
                    status: "error",
                    data: null,
                    error: action.error
                }
            };
    }
}

const WORKFLOWS: { key: WorkflowKey; endpoint: string }[] = [
    {
        key: "keywords",
        endpoint: "/api/mastra/workflows/keywords-extraction/start-async"
    },
    {
        key: "summary",
        endpoint: "/api/mastra/workflows/article-summary/start-async"
    },
    {
        key: "entities",
        endpoint: "/api/mastra/workflows/entities-analysis/start-async"
    },
    {
        key: "blindspots",
        endpoint: "/api/mastra/workflows/blindspots-analysis/start-async"
    },
    {
        key: "media",
        endpoint: "/api/mastra/workflows/media-research/start-async"
    },
    {
        key: "otherMedia",
        endpoint: "/api/mastra/workflows/other-media/start-async"
    },
    {
        key: "cognitiveBias",
        endpoint: "/api/mastra/workflows/cognitive-bias-analysis/start-async"
    },
    {
        key: "sourceVerification",
        endpoint: "/api/mastra/workflows/source-verification/start-async"
    }
];

export function useWorkflowResults(articleData: ArticleData): {
    results: WorkflowResults;
    start: () => void;
} {
    const [results, dispatch] = useReducer(reducer, initialState);
    const controllersRef = useRef<AbortController[]>([]);
    const synthesisControllerRef = useRef<AbortController | null>(null);

    // Trigger synthesis only once all 4 dependencies succeed
    useEffect(() => {
        const {
            blindspots,
            cognitiveBias,
            media,
            otherMedia,
            synthesis,
            sourceVerification
        } = results;
        if (
            blindspots.status === "success" &&
            blindspots.data != null &&
            cognitiveBias.status === "success" &&
            cognitiveBias.data != null &&
            media.status === "success" &&
            media.data != null &&
            otherMedia.status === "success" &&
            otherMedia.data != null &&
            sourceVerification.status === "success" &&
            sourceVerification.data != null &&
            synthesis.status === "idle"
        ) {
            const controller = new AbortController();
            synthesisControllerRef.current = controller;
            dispatch({ type: "LOADING", workflow: "synthesis" });

            fetch("/api/mastra/workflows/synthesis/start-async", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    inputData: {
                        blindspots: (blindspots.data as BlindSpotsResult)
                            .blindspots,
                        cognitiveBias: cognitiveBias.data,
                        media: media.data,
                        otherMedia: (
                            otherMedia.data as unknown as {
                                otherMedia: OtherMediaArticle[];
                            }
                        ).otherMedia,
                        sourceVerification: sourceVerification.data
                    }
                }),
                signal: controller.signal
            })
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then((json) => {
                    dispatch({
                        type: "SUCCESS",
                        workflow: "synthesis",
                        data: json.result
                    });
                })
                .catch((err: unknown) => {
                    if (err instanceof Error && err.name === "AbortError")
                        return;
                    dispatch({
                        type: "ERROR",
                        workflow: "synthesis",
                        error:
                            err instanceof Error ? err.message : "Unknown error"
                    });
                });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        results.blindspots.status,
        results.cognitiveBias.status,
        results.media.status,
        results.otherMedia.status,
        results.sourceVerification.status,
        results.synthesis.status
    ]);

    // Abort synthesis on unmount
    useEffect(() => {
        return () => synthesisControllerRef.current?.abort();
    }, []);

    const start = useCallback(() => {
        controllersRef.current.forEach((c) => c.abort());

        const controllers = WORKFLOWS.map(({ key, endpoint }) => {
            const controller = new AbortController();

            dispatch({ type: "LOADING", workflow: key });

            fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inputData: articleData }),
                signal: controller.signal
            })
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then((json) => {
                    dispatch({
                        type: "SUCCESS",
                        workflow: key,
                        data: json.result
                    });
                })
                .catch((err: unknown) => {
                    if (err instanceof Error && err.name === "AbortError")
                        return;
                    dispatch({
                        type: "ERROR",
                        workflow: key,
                        error:
                            err instanceof Error ? err.message : "Unknown error"
                    });
                });

            return controller;
        });

        controllersRef.current = controllers;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { results, start };
}
