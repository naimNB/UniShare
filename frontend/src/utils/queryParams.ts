import type { ResourceQueryParams } from '../types/api';

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_SEARCH_LENGTH = 200;

export function parsePositiveId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function integerParam(
  params: URLSearchParams,
  name: string,
  label: string,
  min: number,
  max: number,
  errors: string[],
): number | undefined {
  const values = params.getAll(name);
  if (values.length === 0) return undefined;
  if (values.length > 1) {
    errors.push(`${label} must appear only once in the URL.`);
    return undefined;
  }
  const raw = values[0];
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min || value > max) {
    const range = max === Number.MAX_SAFE_INTEGER ? `at least ${min}` : `between ${min} and ${max}`;
    errors.push(`${label} must be a whole number ${range}.`);
    return undefined;
  }
  return value;
}

export function parseResourceParams(params: URLSearchParams): {
  filters: ResourceQueryParams;
  error: string | null;
} {
  const errors: string[] = [];
  const query = (params.get('q') || '').trim();
  if (params.getAll('q').length > 1) errors.push('Search must appear only once in the URL.');
  if (query.length > MAX_SEARCH_LENGTH) errors.push(`Search must contain at most ${MAX_SEARCH_LENGTH} characters.`);
  const filters: ResourceQueryParams = {
    q: query || undefined,
    semester: integerParam(params, 'semester', 'Semester', 1, 12, errors),
    course_id: integerParam(params, 'course_id', 'Course ID', 1, Number.MAX_SAFE_INTEGER, errors),
    category_id: integerParam(params, 'category_id', 'Category ID', 1, Number.MAX_SAFE_INTEGER, errors),
    limit: integerParam(params, 'limit', 'Page size', 1, 100, errors) ?? DEFAULT_PAGE_SIZE,
    offset: integerParam(params, 'offset', 'Page offset', 0, Number.MAX_SAFE_INTEGER, errors) ?? 0,
  };
  return { filters, error: errors.length ? errors.join(' ') : null };
}

export function parseCourseParams(params: URLSearchParams): {
  semester: number | undefined;
  error: string | null;
} {
  const errors: string[] = [];
  const semester = integerParam(params, 'semester', 'Semester', 1, 12, errors);
  return { semester, error: errors.length ? errors.join(' ') : null };
}
