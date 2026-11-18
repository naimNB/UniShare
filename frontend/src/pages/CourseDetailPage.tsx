import { useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BookOpen,
  ArrowLeft,
  ChevronRight,
  Files,
  Download,
  Eye,
  Calendar,
  HardDrive,
  Filter,
} from 'lucide-react';
import { api } from '../api/client';
import { useAsyncData } from '../hooks/useAsyncData';
import { parsePositiveId } from '../utils/queryParams';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { ListSkeleton } from '../components/LoadingSkeleton';
import {
  formatDate,
  formatFileSize,
  getSemesterLabel,
} from '../utils/formatters';

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const courseId = parsePositiveId(id);
  const loadRequest = useCallback((signal: AbortSignal) => api.getCourse(courseId!, signal), [courseId]);
  const { data: course, loading, error: requestError, reload: loadCourse } = useAsyncData(
    id || '', loadRequest, courseId !== null,
  );
  const error = courseId === null ? 'Invalid course ID. Use a positive whole number.' : requestError;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="h-4 w-40 bg-slate-200 rounded-md animate-pulse" />
        <div className="h-48 bg-white rounded-2xl border border-slate-200 animate-pulse p-6" />
        <ListSkeleton count={3} />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <ErrorMessage
          title="Could not load course"
          message={error || 'Course not found'}
          onRetry={loadCourse}
        />
        <div className="mt-6 text-center">
          <Link
            to="/courses"
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Course Directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Link to="/" className="hover:text-indigo-600 transition-colors">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <Link to="/courses" className="hover:text-indigo-600 transition-colors">
          Courses
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-900 font-semibold">{course.code}</span>
      </nav>

      {/* Course Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
              <BookOpen className="w-4 h-4" />
              {course.code}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
              {getSemesterLabel(course.semester)}
            </span>
          </div>

          <Link
            to={`/resources?course_id=${course.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            <Filter className="w-3.5 h-3.5" />
            Filter in Library
          </Link>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
          {course.name}
        </h1>

        {course.description && (
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-4xl mb-6">
            {course.description}
          </p>
        )}

        <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center gap-6 text-xs text-slate-500 font-medium">
          <span className="inline-flex items-center gap-1.5 text-slate-700 font-semibold">
            <Files className="w-4 h-4 text-indigo-600" />
            {course.resource_count} {course.resource_count === 1 ? 'Academic Document' : 'Academic Documents'}
          </span>
          <span>Semester: {course.semester} of 8</span>
          <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Open Access
          </span>
        </div>
      </div>

      {/* Associated Resources Section */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Course Resources & Study Materials
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Lecture notes, laboratory manuals, reference guides, and past exams for {course.code}.
            </p>
          </div>

          <Link
            to="/courses"
            className="text-xs font-semibold text-slate-600 hover:text-indigo-600 inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to All Courses
          </Link>
        </div>

        {course.resources.length > 0 ? (
          <div className="space-y-4">
            {course.resources.map((res) => {
              const downloadUrl = api.getDownloadUrl(res.id);

              return (
                <div
                  key={res.id}
                  className="group bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {res.mime_type.split('/')[1] || 'PDF'}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {res.original_filename}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      <Link to={`/resources/${res.id}`}>{res.title}</Link>
                    </h3>

                    {res.description && (
                      <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 max-w-3xl">
                        {res.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 pt-1">
                      <span className="inline-flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                        {formatFileSize(res.file_size)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(res.created_at)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Download className="w-3.5 h-3.5 text-slate-400" />
                        {res.download_count} downloads
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <Link
                      to={`/resources/${res.id}`}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      Preview
                    </Link>

                    <a
                      href={downloadUrl}
                      download={res.original_filename}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No materials uploaded for this course yet"
            message={`There are currently no academic resources cataloged under ${course.code} (${course.name}). Check back soon or explore other curriculum subjects.`}
            icon="folder"
            action={
              <Link
                to="/courses"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
              >
                Browse Other Courses
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
