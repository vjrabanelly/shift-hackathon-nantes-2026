import { useEffect, useReducer } from "react";
import type { ArticleData, WorkflowState } from "@/lib/types";

type State = WorkflowState<ArticleData>;

type Action =
    | { type: "LOADING" }
    | { type: "SUCCESS"; data: ArticleData }
    | { type: "ERROR"; error: string };

function reducer(_state: State, action: Action): State {
    switch (action.type) {
        case "LOADING":
            return { status: "loading", data: null, error: null };
        case "SUCCESS":
            return { status: "success", data: action.data, error: null };
        case "ERROR":
            return { status: "error", data: null, error: action.error };
    }
}

const initialState: State = { status: "idle", data: null, error: null };

export function useArticleExtraction(url: string): State {
    const [state, dispatch] = useReducer(reducer, initialState);

    useEffect(() => {
        const controller = new AbortController();

        dispatch({ type: "LOADING" });

        fetch("/api/mastra/workflows/article-extractor/start-async", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inputData: { url } }),
            signal: controller.signal
        })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((json) => {
                dispatch({ type: "SUCCESS", data: json.result });
            })
            .catch((err: unknown) => {
                if (err instanceof Error && err.name === "AbortError") return;
                dispatch({
                    type: "ERROR",
                    error: err instanceof Error ? err.message : "Unknown error"
                });
            });

        return () => controller.abort();
    }, [url]);

    return state;
}
