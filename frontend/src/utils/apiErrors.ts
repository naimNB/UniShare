/** Convert FastAPI validation responses to readable text without exposing request input. */
export function formatApiError(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const body = payload as Record<string, unknown>;
  const detail = body.detail ?? body.message;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (!Array.isArray(detail)) return undefined;
  const messages = detail.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return [];
    const validation = item as Record<string, unknown>;
    if (typeof validation.msg !== 'string') return [];
    const location = Array.isArray(validation.loc)
      ? validation.loc.filter((part) => (typeof part === 'string' || typeof part === 'number') && part !== 'query' && part !== 'body' && part !== 'path').join('.')
      : '';
    return [location ? `${location}: ${validation.msg}` : validation.msg];
  });
  return messages.length ? messages.join('; ') : undefined;
}
