import { useEffect, useState } from 'react';
import { startRequest } from '../utils/asyncRequest';

interface Result<T> {
  key: string;
  attempt: number;
  data: T | null;
  error: string | null;
}

/** Each URL/retry gets its own result; old data cannot appear under new filters. */
export function useAsyncData<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  enabled = true,
) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    return startRequest(
      load,
      (data) => setResult({ key, attempt, data, error: null }),
      (error) => setResult({
        key,
        attempt,
        data: null,
        error: error instanceof Error ? error.message : 'Could not load data. Please try again.',
      }),
    );
  }, [key, attempt, load, enabled]);

  const current = enabled && result?.key === key && result.attempt === attempt ? result : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: enabled && current === null,
    reload: () => setAttempt((previous) => previous + 1),
  };
}
