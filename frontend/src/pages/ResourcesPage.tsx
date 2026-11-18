import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  X,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import type { Category, Course, PaginatedResources } from '../types/api';
import { ResourceCard } from '../components/ResourceCard';
import { Pagination } from '../components/Pagination';
import { GridSkeleton } from '../components/LoadingSkeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { getSemesterOrdinal } from '../utils/formatters';

const PAGE_SIZE = 12;

export function ResourcesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter values from URL query
  const queryParam = searchParams.get('q') || '';
  const semesterParam = searchParams.get('semester');
  const courseIdParam = searchParams.get('course_id');
  const categoryIdParam = searchParams.get('category_id');
  const offsetParam = searchParams.get('offset');

  const selectedSemester = semesterParam ? parseInt(semesterParam, 10) : undefined;
  const selectedCourseId = courseIdParam ? parseInt(courseIdParam, 10) : undefined;
  const selectedCategoryId = categoryIdParam ? parseInt(categoryIdParam, 10) : undefined;
  const currentOffset = offsetParam ? parseInt(offsetParam, 10) : 0;

  // Local state for search input typing
  const [searchInput, setSearchInput] = useState(queryParam);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paginatedData, setPaginatedData] = useState<PaginatedResources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Synchronize local search input if URL changes
  useEffect(() => {
    setSearchInput(queryParam);
  }, [queryParam]);

  // Load auxiliary courses and categories for dropdown filters
  useEffect(() => {
    async function loadAuxiliaryData() {
      try {
        const [coursesList, categoriesList] = await Promise.all([
          api.getCourses(),
          api.getCategories(),
        ]);
        setCourses(coursesList);
        setCategories(categoriesList);
      } catch (err) {
        console.error('Failed to load filter metadata:', err);
      }
    }
    loadAuxiliaryData();
  }, []);

  // Fetch resources when filter URL params change
  const fetchResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getResources({
        q: queryParam || undefined,
        semester: selectedSemester,
        course_id: selectedCourseId,
        category_id: selectedCategoryId,
        limit: PAGE_SIZE,
        offset: currentOffset,
      });
      setPaginatedData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resources');
    } finally {
      setLoading(false);
    }
  }, [queryParam, selectedSemester, selectedCourseId, selectedCategoryId, currentOffset]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  // Update URL helper
  const updateParams = (updates: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === undefined || val === '') {
        nextParams.delete(key);
      } else {
        nextParams.set(key, val);
      }
    });
    // Reset offset to 0 whenever filter conditions change, unless offset is explicitly set
    if (!('offset' in updates)) {
      nextParams.delete('offset');
    }
    setSearchParams(nextParams);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ q: searchInput.trim() || null });
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters =
    Boolean(queryParam) ||
    selectedSemester !== undefined ||
    selectedCourseId !== undefined ||
    selectedCategoryId !== undefined;

  // Selected filter labels for badges
  const activeCourse = courses.find((c) => c.id === selectedCourseId);
  const activeCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Academic Repository
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Resource Library
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-2 max-w-2xl leading-relaxed">
          Search and filter university lecture notes, past exams, laboratory guides, and syllabi. Preview documents inline or download for offline study.
        </p>
      </div>

      {/* Multi-facet Filter Panel */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
        {/* Search Row */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by topic, document title, or description (e.g. BCNF, Sockets, Dynamic Programming)..."
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 transition-all text-slate-900 placeholder:text-slate-400"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  updateParams({ q: null });
                }}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                aria-label="Clear search text"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-2xs hover:shadow-xs transition-colors shrink-0 inline-flex items-center gap-1.5"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Search</span>
          </button>
        </form>

        {/* Filter Dropdowns Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          {/* Semester Filter */}
          <div>
            <label
              htmlFor="filter-semester"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Semester
            </label>
            <select
              id="filter-semester"
              value={selectedSemester !== undefined ? selectedSemester.toString() : ''}
              onChange={(e) => {
                const newSem = e.target.value ? parseInt(e.target.value, 10) : undefined;
                // If a course was selected and it doesn't match the new semester, reset course_id
                const courseMatches =
                  newSem === undefined ||
                  (activeCourse && activeCourse.semester === newSem);
                updateParams({
                  semester: e.target.value || null,
                  course_id: courseMatches && selectedCourseId ? selectedCourseId.toString() : null,
                });
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <option key={sem} value={sem}>
                  {getSemesterOrdinal(sem)} Semester
                </option>
              ))}
            </select>
          </div>

          {/* Course Filter */}
          <div>
            <label
              htmlFor="filter-course"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Course
            </label>
            <select
              id="filter-course"
              value={selectedCourseId !== undefined ? selectedCourseId.toString() : ''}
              onChange={(e) => updateParams({ course_id: e.target.value || null })}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden truncate"
            >
              <option value="">
                {selectedSemester !== undefined
                  ? `All Semester ${selectedSemester} Courses`
                  : 'All Courses'}
              </option>
              {(selectedSemester !== undefined
                ? courses.filter((c) => c.semester === selectedSemester)
                : courses
              ).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} – {c.name} {selectedSemester === undefined ? `(Sem ${c.semester})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label
              htmlFor="filter-category"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Category
            </label>
            <select
              id="filter-category"
              value={selectedCategoryId !== undefined ? selectedCategoryId.toString() : ''}
              onChange={(e) => updateParams({ category_id: e.target.value || null })}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.resource_count})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Badges & Reset */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs">
            <span className="font-semibold text-slate-500">Active filters:</span>

            {queryParam && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                Query: "{queryParam}"
                <button
                  type="button"
                  onClick={() => updateParams({ q: null })}
                  className="hover:text-indigo-900"
                  aria-label="Remove search query filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}

            {selectedSemester !== undefined && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                {getSemesterOrdinal(selectedSemester)} Semester
                <button
                  type="button"
                  onClick={() => updateParams({ semester: null })}
                  className="hover:text-indigo-900"
                  aria-label="Remove semester filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}

            {activeCourse && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                Course: {activeCourse.code}
                <button
                  type="button"
                  onClick={() => updateParams({ course_id: null })}
                  className="hover:text-indigo-900"
                  aria-label="Remove course filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}

            {activeCategory && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                Category: {activeCategory.name}
                <button
                  type="button"
                  onClick={() => updateParams({ category_id: null })}
                  className="hover:text-indigo-900"
                  aria-label="Remove category filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-slate-900 hover:underline font-semibold ml-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset All
            </button>
          </div>
        )}
      </div>

      {/* Results Section */}
      {error && <ErrorMessage message={error} onRetry={fetchResources} />}

      {loading ? (
        <GridSkeleton count={6} />
      ) : paginatedData && paginatedData.items.length > 0 ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>
              Found{' '}
              <span className="font-bold text-slate-900">{paginatedData.total}</span>{' '}
              {paginatedData.total === 1 ? 'academic resource' : 'academic resources'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedData.items.map((res) => (
              <ResourceCard key={res.id} resource={res} />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            total={paginatedData.total}
            limit={paginatedData.limit}
            offset={paginatedData.offset}
            onPageChange={(newOffset) =>
              updateParams({ offset: newOffset > 0 ? newOffset.toString() : null })
            }
          />
        </div>
      ) : (
        <EmptyState
          title="No resources match your filter criteria"
          message="No study materials were found with the selected combinations. Try clearing some filters or searching for a broader term."
          action={
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              Clear All Filters
            </button>
          }
        />
      )}
    </div>
  );
}
