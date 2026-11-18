import type {
  Category,
  Course,
  CourseDetail,
  HealthResponse,
  PaginatedResources,
  Resource,
  ResourceQueryParams,
} from '../types/api';
import { formatApiError } from '../utils/apiErrors';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  detail?: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      let errorDetail: string | undefined;
      try {
        const errorJson = await response.json();
        errorDetail = formatApiError(errorJson);
      } catch {
        // Response is not JSON
      }

      const message =
        errorDetail ||
        `Request failed with status ${response.status} (${response.statusText})`;
      throw new ApiError(response.status, message, errorDetail);
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof ApiError || options?.signal?.aborted) {
      throw err;
    }
    const message =
      err instanceof Error ? err.message : 'An unknown network error occurred';
    throw new ApiError(0, message);
  }
}

export const api = {
  /**
   * Health status check
   */
  async getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>('/api/health');
  },

  /**
   * Fetch courses, optionally filtered by semester (1-8)
   */
  async getCourses(semester?: number, signal?: AbortSignal): Promise<Course[]> {
    const params = new URLSearchParams();
    if (semester !== undefined && semester > 0) {
      params.set('semester', semester.toString());
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<Course[]>(`/api/courses${query}`, { signal });
  },

  /**
   * Fetch a single course with its associated resources
   */
  async getCourse(id: number, signal?: AbortSignal): Promise<CourseDetail> {
    return request<CourseDetail>(`/api/courses/${id}`, { signal });
  },

  /**
   * Fetch all resource categories with counts
   */
  async getCategories(signal?: AbortSignal): Promise<Category[]> {
    return request<Category[]>('/api/categories', { signal });
  },

  /**
   * Fetch paginated resources with optional multi-facet filters
   */
  async getResources(params?: ResourceQueryParams, signal?: AbortSignal): Promise<PaginatedResources> {
    const queryParams = new URLSearchParams();

    if (params) {
      if (params.q && params.q.trim()) {
        queryParams.set('q', params.q.trim());
      }
      if (params.semester !== undefined && params.semester > 0) {
        queryParams.set('semester', params.semester.toString());
      }
      if (params.course_id !== undefined && params.course_id > 0) {
        queryParams.set('course_id', params.course_id.toString());
      }
      if (params.category_id !== undefined && params.category_id > 0) {
        queryParams.set('category_id', params.category_id.toString());
      }
      if (params.limit !== undefined) {
        queryParams.set('limit', params.limit.toString());
      }
      if (params.offset !== undefined) {
        queryParams.set('offset', params.offset.toString());
      }
    }

    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return request<PaginatedResources>(`/api/resources${query}`, { signal });
  },

  /**
   * Fetch detailed resource metadata
   */
  async getResource(id: number, signal?: AbortSignal): Promise<Resource> {
    return request<Resource>(`/api/resources/${id}`, { signal });
  },

  /**
   * Returns direct preview URL for PDF / document inline view
   */
  getPreviewUrl(id: number): string {
    return `${API_BASE}/api/resources/${id}/preview`;
  },

  /**
   * Returns direct download URL for attachment
   */
  getDownloadUrl(id: number): string {
    return `${API_BASE}/api/resources/${id}/download`;
  },
};
