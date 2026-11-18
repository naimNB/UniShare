import type {
  Category,
  Course,
  CourseDetail,
  HealthResponse,
  PaginatedResources,
  Resource,
  ResourceQueryParams,
} from '../types/api';

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
        errorDetail = errorJson.detail || errorJson.message;
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
    if (err instanceof ApiError) {
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
  async getCourses(semester?: number): Promise<Course[]> {
    const params = new URLSearchParams();
    if (semester !== undefined && semester > 0) {
      params.set('semester', semester.toString());
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<Course[]>(`/api/courses${query}`);
  },

  /**
   * Fetch a single course with its associated resources
   */
  async getCourse(id: number): Promise<CourseDetail> {
    return request<CourseDetail>(`/api/courses/${id}`);
  },

  /**
   * Fetch all resource categories with counts
   */
  async getCategories(): Promise<Category[]> {
    return request<Category[]>('/api/categories');
  },

  /**
   * Fetch paginated resources with optional multi-facet filters
   */
  async getResources(params?: ResourceQueryParams): Promise<PaginatedResources> {
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
    return request<PaginatedResources>(`/api/resources${query}`);
  },

  /**
   * Fetch detailed resource metadata
   */
  async getResource(id: number): Promise<Resource> {
    return request<Resource>(`/api/resources/${id}`);
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
