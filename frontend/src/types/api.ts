export interface CourseSummary {
  id: number;
  code: string;
  name: string;
  semester: number;
  credits: number;
  display_order?: number;
  year?: number;
  term?: number;
}

export interface CategorySummary {
  id: number;
  name: string;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  semester: number;
  credits: number;
  display_order: number;
  year: number;
  term: number;
  description: string | null;
  resource_count: number;
}

export interface ResourceSummary {
  id: number;
  title: string;
  description: string | null;
  original_filename: string;
  mime_type: string;
  file_size: number | null;
  created_at: string;
  download_count: number;
}

export interface CourseDetail extends Course {
  resources: ResourceSummary[];
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  resource_count: number;
}

export interface Resource {
  id: number;
  title: string;
  description: string | null;
  course_id: number;
  category_id: number;
  original_filename: string;
  mime_type: string;
  file_size: number | null;
  created_at: string;
  download_count: number;
  course: CourseSummary | null;
  category: CategorySummary | null;
}

export interface PaginatedResources {
  items: Resource[];
  total: number;
  limit: number;
  offset: number;
}

export interface ResourceQueryParams {
  q?: string;
  semester?: number;
  course_id?: number;
  category_id?: number;
  limit?: number;
  offset?: number;
}

export interface HealthResponse {
  status: string;
  app: string;
  version: string;
}

export interface SubmissionCreateResponse {
  id: number;
  title: string;
  status: string;
  message: string;
}
