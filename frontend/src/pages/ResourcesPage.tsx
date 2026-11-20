import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  X,
  RotateCcw,
  Files,
  Upload,
} from 'lucide-react';
import { api } from '../api/client';
import { useAsyncData } from '../hooks/useAsyncData';
import { MAX_SEARCH_LENGTH, parseResourceParams } from '../utils/queryParams';
import { ResourceCard } from '../components/ResourceCard';
import { Pagination } from '../components/Pagination';
import { GridSkeleton } from '../components/LoadingSkeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { getSemesterOrdinal } from '../utils/formatters';

const ACADEMIC_YEARS = [
  { year: 1, label: 'Year 1 (Semesters 1 & 2)', semesters: [1, 2] },
  { year: 2, label: 'Year 2 (Semesters 3 & 4)', semesters: [3, 4] },
  { year: 3, label: 'Year 3 (Semesters 5 & 6)', semesters: [5, 6] },
  { year: 4, label: 'Year 4 (Semesters 7 & 8)', semesters: [7, 8] },
];

export function ResourcesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const { filters, error: queryError } = useMemo(
    () => parseResourceParams(new URLSearchParams(queryKey)),
    [queryKey]
  );
  const queryParam = filters.q || '';
  const selectedSemester = filters.semester;
  const selectedCourseId = filters.course_id;
  const selectedCategoryId = filters.category_id;

  // Selected Year local state or derived from selectedSemester / activeCourse
  const [yearOverride, setYearOverride] = useState<number | null>(null);

  // Reset the draft when the URL query changes
  const [searchInput, setSearchInput] = useState(queryParam);
  const [previousQuery, setPreviousQuery] = useState(queryParam);
  if (previousQuery !== queryParam) {
    setPreviousQuery(queryParam);
    setSearchInput(queryParam);
  }

  const loadMetadata = useCallback(async (signal: AbortSignal) => {
    const [courses, categories] = await Promise.all([
      api.getCourses(undefined, signal),
      api.getCategories(signal),
    ]);
    return { courses, categories };
  }, []);
  const metadata = useAsyncData('filters', loadMetadata);
  const courses = useMemo(() => metadata.data?.courses || [], [metadata.data?.courses]);
  const categories = useMemo(() => metadata.data?.categories || [], [metadata.data?.categories]);

  const loadResources = useCallback(
    (signal: AbortSignal) => api.getResources(filters, signal),
    [filters]
  );
  const {
    data: paginatedData,
    loading,
    error,
    reload: fetchResources,
  } = useAsyncData(queryKey, loadResources, !queryError);

  // Active filters lookup
  const activeCourse = courses.find((c) => c.id === selectedCourseId);
  const activeCategory = categories.find((c) => c.id === selectedCategoryId);

  // Effective year derived from semester or course or override
  const effectiveYear = useMemo(() => {
    if (selectedSemester !== undefined) {
      return Math.ceil(selectedSemester / 2);
    }
    if (activeCourse) {
      return activeCourse.year || Math.ceil(activeCourse.semester / 2);
    }
    return yearOverride;
  }, [selectedSemester, activeCourse, yearOverride]);

  // Derived semester options based on effective year
  const availableSemesters = useMemo(() => {
    if (effectiveYear) {
      const yearObj = ACADEMIC_YEARS.find((y) => y.year === effectiveYear);
      return yearObj ? yearObj.semesters : [1, 2, 3, 4, 5, 6, 7, 8];
    }
    return [1, 2, 3, 4, 5, 6, 7, 8];
  }, [effectiveYear]);

  // Filtered courses based on semester (or year if no single semester is selected)
  const availableCourses = useMemo(() => {
    if (selectedSemester !== undefined) {
      return courses.filter((c) => c.semester === selectedSemester);
    }
    if (effectiveYear) {
      const semList = (effectiveYear - 1) * 2 + 1;
      return courses.filter((c) => c.semester === semList || c.semester === semList + 1);
    }
    return courses;
  }, [courses, selectedSemester, effectiveYear]);

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
    setYearOverride(null);
    setSearchParams(new URLSearchParams());
  };

  const handleYearChange = (yearStr: string) => {
    if (!yearStr) {
      setYearOverride(null);
      updateParams({ semester: null, course_id: null });
      return;
    }
    const yr = parseInt(yearStr, 10);
    setYearOverride(yr);
    // If current selected semester is outside this year, clear semester and course
    if (selectedSemester && Math.ceil(selectedSemester / 2) !== yr) {
      updateParams({ semester: null, course_id: null });
    }
  };

  const hasActiveFilters =
    Boolean(queryParam) ||
    effectiveYear !== null ||
    selectedSemester !== undefined ||
    selectedCourseId !== undefined ||
    selectedCategoryId !== undefined;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5EEE8] border border-[#CBDAD0] text-[#164A41] text-xs font-semibold mb-3">
            <Files className="w-3.5 h-3.5" />
            University Academic Library
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1D2933] tracking-tight">
            Academic Resource Library
          </h1>
          <p className="text-sm sm:text-base text-[#566775] mt-2 max-w-2xl leading-relaxed">
            Search and filter lecture notes, laboratory manuals, past exam questions, and official course syllabi across all degree semesters.
          </p>
        </div>

        <Link
          to="/contribute"
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#C26B3D] hover:bg-[#A5552D] text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
        >
          <Upload className="w-4 h-4" />
          Share Your Notes
        </Link>
      </div>

      {/* Cascading Multi-facet Filter Panel */}
      <div className="bg-white rounded-xl border border-[#DDE3DC] p-5 sm:p-6 shadow-2xs space-y-5">
        {/* Search Row */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#566775]" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search resources and courses"
              maxLength={MAX_SEARCH_LENGTH}
              placeholder="Search by course code, title, topic, or keyword (e.g. CSE 3101, SQL, OS)..."
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-[#F6F4EF] border border-[#DDE3DC] rounded-lg focus:bg-white focus:border-[#164A41] focus:outline-hidden focus:ring-1 focus:ring-[#164A41] transition-all text-[#1D2933] placeholder:text-[#566775]"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  updateParams({ q: null });
                }}
                className="absolute right-3 top-3 text-[#566775] hover:text-[#1D2933]"
                aria-label="Clear search text"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            aria-label="Search resources"
            className="px-5 py-2.5 bg-[#164A41] hover:bg-[#103831] text-white font-semibold text-sm rounded-lg shadow-2xs transition-colors shrink-0 inline-flex items-center gap-1.5"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Search</span>
          </button>
        </form>

        {metadata.error && (
          <ErrorMessage
            title="Course and category filters are unavailable"
            message={metadata.error}
            onRetry={metadata.reload}
          />
        )}

        {/* Cascading Filter Dropdowns Row: Year -> Semester -> Course -> Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[#DDE3DC]">
          {/* 1. Academic Year Filter */}
          <div>
            <label
              htmlFor="filter-year"
              className="block text-xs font-semibold text-[#1D2933] mb-1"
            >
              Academic Year
            </label>
            <select
              id="filter-year"
              value={effectiveYear !== null && effectiveYear !== undefined ? effectiveYear.toString() : ''}
              onChange={(e) => handleYearChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#F6F4EF] border border-[#DDE3DC] rounded-lg text-[#1D2933] focus:bg-white focus:border-[#164A41] focus:outline-hidden"
            >
              <option value="">All Academic Years</option>
              {ACADEMIC_YEARS.map((y) => (
                <option key={y.year} value={y.year}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Semester Filter (Cascading) */}
          <div>
            <label
              htmlFor="filter-semester"
              className="block text-xs font-semibold text-[#1D2933] mb-1"
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
              className="w-full px-3 py-2 text-sm bg-[#F6F4EF] border border-[#DDE3DC] rounded-lg text-[#1D2933] focus:bg-white focus:border-[#164A41] focus:outline-hidden"
            >
              <option value="">
                {effectiveYear ? `All Year ${effectiveYear} Semesters` : 'All Semesters'}
              </option>
              {availableSemesters.map((sem) => (
                <option key={sem} value={sem}>
                  {getSemesterOrdinal(sem)} Semester
                </option>
              ))}
            </select>
          </div>

          {/* 3. Course Filter (Cascading) */}
          <div>
            <label
              htmlFor="filter-course"
              className="block text-xs font-semibold text-[#1D2933] mb-1"
            >
              Course
            </label>
            <select
              id="filter-course"
              disabled={metadata.loading || !!metadata.error}
              value={selectedCourseId !== undefined ? selectedCourseId.toString() : ''}
              onChange={(e) => updateParams({ course_id: e.target.value || null })}
              className="w-full px-3 py-2 text-sm bg-[#F6F4EF] border border-[#DDE3DC] rounded-lg text-[#1D2933] focus:bg-white focus:border-[#164A41] focus:outline-hidden truncate"
            >
              <option value="">
                {selectedSemester !== undefined
                  ? `All Semester ${selectedSemester} Courses`
                  : effectiveYear
                  ? `All Year ${effectiveYear} Courses`
                  : 'All Courses'}
              </option>
              {availableCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} – {c.name} {selectedSemester === undefined ? `(Sem ${c.semester})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Category Filter */}
          <div>
            <label
              htmlFor="filter-category"
              className="block text-xs font-semibold text-[#1D2933] mb-1"
            >
              Category
            </label>
            <select
              id="filter-category"
              disabled={metadata.loading || !!metadata.error}
              value={selectedCategoryId !== undefined ? selectedCategoryId.toString() : ''}
              onChange={(e) => updateParams({ category_id: e.target.value || null })}
              className="w-full px-3 py-2 text-sm bg-[#F6F4EF] border border-[#DDE3DC] rounded-lg text-[#1D2933] focus:bg-white focus:border-[#164A41] focus:outline-hidden"
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
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#DDE3DC] text-xs">
            <span className="font-semibold text-[#566775]">Active filters:</span>

            {queryParam && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#E5EEE8] text-[#164A41] border border-[#CBDAD0] font-medium">
                Query: &ldquo;{queryParam}&rdquo;
                <button
                  type="button"
                  onClick={() => updateParams({ q: null })}
                  className="hover:text-[#103831]"
                  aria-label="Remove search query filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}

            {effectiveYear && selectedSemester === undefined && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#E5EEE8] text-[#164A41] border border-[#CBDAD0] font-medium">
                Year {effectiveYear}
                <button
                  type="button"
                  onClick={() => setYearOverride(null)}
                  className="hover:text-[#103831]"
                  aria-label="Remove year filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}

            {selectedSemester !== undefined && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#E5EEE8] text-[#164A41] border border-[#CBDAD0] font-medium">
                {getSemesterOrdinal(selectedSemester)} Semester
                <button
                  type="button"
                  onClick={() => updateParams({ semester: null })}
                  className="hover:text-[#103831]"
                  aria-label="Remove semester filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}

            {activeCourse && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#E5EEE8] text-[#164A41] border border-[#CBDAD0] font-medium">
                Course: {activeCourse.code}
                <button
                  type="button"
                  onClick={() => updateParams({ course_id: null })}
                  className="hover:text-[#103831]"
                  aria-label="Remove course filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}

            {activeCategory && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#E5EEE8] text-[#164A41] border border-[#CBDAD0] font-medium">
                Category: {activeCategory.name}
                <button
                  type="button"
                  onClick={() => updateParams({ category_id: null })}
                  className="hover:text-[#103831]"
                  aria-label="Remove category filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2 py-1 text-[#566775] hover:text-[#164A41] hover:underline font-semibold ml-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset All
            </button>
          </div>
        )}
      </div>

      {/* Results Section */}
      {queryError ? (
        <ErrorMessage
          title="Invalid library URL"
          message={`${queryError} Clear the URL filters to continue.`}
          onRetry={handleResetFilters}
          retryLabel="Clear URL filters"
        />
      ) : loading ? (
        <GridSkeleton count={6} />
      ) : error ? (
        <ErrorMessage message={error} onRetry={fetchResources} />
      ) : paginatedData && paginatedData.items.length > 0 ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs font-semibold text-[#566775]">
            <span>
              Showing{' '}
              <span className="font-bold text-[#1D2933]">{paginatedData.total}</span>{' '}
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
          title={
            paginatedData && paginatedData.total > 0
              ? 'This page is beyond the available results'
              : 'No resources match your filter criteria'
          }
          message={
            paginatedData && paginatedData.total > 0
              ? 'Return to the first page to see resources matching these filters.'
              : 'No study materials were found with the selected combinations. You can clear some filters, try a broader keyword, or be the first to contribute notes for this subject.'
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  paginatedData && paginatedData.total > 0
                    ? updateParams({ offset: null })
                    : handleResetFilters()
                }
                className="px-4 py-2 bg-[#164A41] hover:bg-[#103831] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
              >
                {paginatedData && paginatedData.total > 0
                  ? 'Return to First Page'
                  : 'Clear All Filters'}
              </button>
              <Link
                to="/contribute"
                className="px-4 py-2 bg-[#C26B3D] hover:bg-[#A5552D] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
              >
                Contribute Notes
              </Link>
            </div>
          }
        />
      )}
    </div>
  );
}
