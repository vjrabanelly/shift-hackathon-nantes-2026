import { useEffect, useRef, useState } from 'react';
import { SseEventType, type SseEvent, type AnalysisResult } from '@marie/shared';

const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '/api');
const API_KEY = import.meta.env.VITE_API_KEY as string | undefined;

interface StreamState {
  events: SseEvent[];
  result: AnalysisResult | null;
  status: 'connecting' | 'streaming' | 'completed' | 'failed';
  error: string | null;
}

export function useAnalysisStream(analysisId: string): StreamState {
  const [state, setState] = useState<StreamState>({
    events: [],
    result: null,
    status: 'connecting',
    error: null,
  });
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const streamUrl = `${API_BASE}/analyses/${analysisId}/stream${API_KEY ? `?key=${encodeURIComponent(API_KEY)}` : ''}`;
    const es = new EventSource(streamUrl);
    esRef.current = es;

    const handleEvent = (raw: MessageEvent) => {
      try {
        const event = JSON.parse(raw.data as string) as SseEvent;
        setState((prev) => {
          const next: StreamState = {
            ...prev,
            events: [...prev.events, event],
            status: 'streaming',
            error: null,
          };
          if (event.event === SseEventType.AnalysisCompleted) {
            next.result = event.data as AnalysisResult;
            next.status = 'completed';
          }
          if (event.event === SseEventType.AnalysisFailed) {
            next.status = 'failed';
            next.error = (event.data as { error: string }).error;
          }
          return next;
        });
      } catch {
        // ignore parse errors
      }
    };

    // Listen to all SSE event types
    Object.values(SseEventType).forEach((type) => {
      es.addEventListener(type, handleEvent);
    });

    es.onerror = () => {
      setState((prev) =>
        prev.status === 'completed' || prev.status === 'failed'
          ? prev
          : { ...prev, status: 'failed', error: 'Connexion au stream interrompue.' },
      );
      es.close();
    };

    return () => {
      es.close();
    };
  }, [analysisId]);

  return state;
}
