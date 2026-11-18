/** Cancellation also guards callbacks when an implementation ignores AbortSignal. */
export function startRequest<T>(
  load: (signal: AbortSignal) => Promise<T>,
  onSuccess: (data: T) => void,
  onError: (error: unknown) => void,
): () => void {
  const controller = new AbortController();
  Promise.resolve()
    .then(() => controller.signal.aborted ? undefined : load(controller.signal))
    .then((data) => {
      if (!controller.signal.aborted) onSuccess(data as T);
    })
    .catch((error: unknown) => {
      if (!controller.signal.aborted) onError(error);
    });
  return () => controller.abort();
}
