import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Search, Filter, X } from 'lucide-react';
import { api } from '../api/client';
import type { Course } from '../types/api';
import { CourseCard } from '../components/CourseCard';
import { GridSkeleton } from '../components/LoadingSkeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { getSemesterOrdinal } from '../utils/formatters';

export function CoursesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');

  // Selected semester from URL query or null for all
  const semesterParam = searchParams.get('semester');
  const selectedSemester = semesterParam ? parseInt(semesterParam, 10) : null;

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all courses or filtered by semester
      const data = await api.getCourses(selectedSemester || undefined);
      setCourses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, [selectedSemester]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const handleSemesterSelect = (sem: number | null) => {
    const nextParams = new URLSearchParams(searchParams);
    if (sem === null) {
      nextParams.delete('semester');
    } else {
      nextParams.set('semester', sem.toString());
    }
    setSearchParams(nextParams);
  };

  // Filter in-memory by course code / name search
  const filteredCourses = useMemo(() => {
    if (!filterQuery.trim()) return courses;
    const q = filterQuery.toLowerCase();
    return courses.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [courses, filterQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-3">
          <BookOpen className="w-3.5 h-3.5" />
          Academic Curriculum
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          University Course Directory
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-2 max-w-2xl leading-relaxed">
          Explore courses organized semester by semester. Access syllabus outlines, lecture notes, lab manuals, and previous examination questions for every subject.
        </p>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter courses by code (e.g. CSE 3101) or title (e.g. Operating Systems)..."
            className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 transition-all text-slate-900"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              aria-label="Clear filter"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Semester selector tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            Semester:
          </span>

          <button
            type="button"
            onClick={() => handleSemesterSelect(null)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
              selectedSemester === null
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            All Semesters
          </button>

          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
            <button
              key={sem}
              type="button"
              onClick={() => handleSemesterSelect(sem)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                selectedSemester === sem
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {getSemesterOrdinal(sem)} Sem
            </button>
          ))}
        </div>
      </div>

      {/* Courses List */}
      {error && <ErrorMessage message={error} onRetry={loadCourses} />}

      {loading ? (
        <GridSkeleton count={6} />
      ) : filteredCourses.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-4 text-xs font-medium text-slate-500">
            <span>
              Showing <span className="font-semibold text-slate-900">{filteredCourses.length}</span>{' '}
              {filteredCourses.length === 1 ? 'course' : 'courses'}
            </span>
            {selectedSemester && (
              <button
                type="button"
                onClick={() => handleSemesterSelect(null)}
                className="text-indigo-600 hover:underline font-semibold"
              >
                Clear semester filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          title="No courses matched your query"
          message={
            filterQuery
              ? `No courses matching "${filterQuery}" were found. Try a different keyword.`
              : 'No courses found in this semester.'
          }
          action={
            <button
              type="button"
              onClick={() => {
                setFilterQuery('');
                handleSemesterSelect(null);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              View All Courses
            </button>
          }
        />
      )}
    </div>
  );
}
