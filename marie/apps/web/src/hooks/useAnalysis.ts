import { useEffect, useState } from 'react';
import { getAnalysis } from '../api/analyses.api.js';

export function useAnalysis(id: string) {
  const [analysis, setAnalysis] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAnalysis(id)
      .then(setAnalysis)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return { analysis, loading, error };
}
