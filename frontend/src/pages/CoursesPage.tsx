import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Search, Filter, X, GraduationCap } from 'lucide-react';
import { api } from '../api/client';
import { useAsyncData } from '../hooks/useAsyncData';
import { parseCourseParams } from '../utils/queryParams';
import { CourseCard } from '../components/CourseCard';
import { GridSkeleton } from '../components/LoadingSkeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { getSemesterOrdinal } from '../utils/formatters';

const ACADEMIC_YEARS = [
  {
    year: 1,
    title: '1st Year',
    semesters: [
      { semester: 1, termLabel: '1st Semester' },
      { semester: 2, termLabel: '2nd Semester' },
    ],
  },
  {
    year: 2,
    title: '2nd Year',
    semesters: [
      { semester: 3, termLabel: '1st Semester' },
      { semester: 4, termLabel: '2nd Semester' },
    ],
  },
  {
    year: 3,
    title: '3rd Year',
    semesters: [
      { semester: 5, termLabel: '1st Semester' },
      { semester: 6, termLabel: '2nd Semester' },
    ],
  },
  {
    year: 4,
    title: '4th Year',
    semesters: [
      { semester: 7, termLabel: '1st Semester' },
      { semester: 8, termLabel: '2nd Semester' },
    ],
  },
];

export function CoursesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterQuery, setFilterQuery] = useState('');
  const { semester, error: queryError } = parseCourseParams(searchParams);
  const selectedSemester = semester ?? null;
  const loadCoursesRequest = useCallback(
    (signal: AbortSignal) => api.getCourses(semester, signal),
    [semester]
  );
  const { data, loading, error, reload: loadCourses } = useAsyncData(
    searchParams.toString(),
    loadCoursesRequest,
    !queryError
  );
  const courses = useMemo(() => data || [], [data]);

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
    const q = filterQuery.trim().toLowerCase();
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
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5EEE8] border border-[#CBDAD0] text-[#164A41] text-xs font-semibold mb-3">
          <BookOpen className="w-3.5 h-3.5" />
          Academic Curriculum &bull; 8 Semesters &bull; 161 Credits
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1D2933] tracking-tight">
          University Course Directory
        </h1>
        <p className="text-sm sm:text-base text-[#566775] mt-2 max-w-2xl leading-relaxed">
          Explore all 78 official courses organized across 4 academic years. Access lecture notes, lab manuals, syllabus outlines, and past exam questions.
        </p>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white rounded-xl border border-[#DDE3DC] p-4 sm:p-5 shadow-2xs space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#566775]" />
          <input
            type="search"
            aria-label="Filter courses by code or name"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter courses by code (e.g. CSE 2103) or title (e.g. Operating Systems)..."
            className="w-full pl-10 pr-10 py-2.5 text-sm bg-[#F6F4EF] border border-[#DDE3DC] rounded-lg focus:bg-white focus:border-[#164A41] focus:outline-hidden focus:ring-1 focus:ring-[#164A41] transition-all text-[#1D2933]"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className="absolute right-3 top-3 text-[#566775] hover:text-[#1D2933]"
              aria-label="Clear filter"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Semester selector tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
          <span className="text-xs font-bold text-[#566775] uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            Semester:
          </span>

          <button
            type="button"
            onClick={() => handleSemesterSelect(null)}
            aria-pressed={selectedSemester === null}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold shrink-0 transition-colors ${
              selectedSemester === null
                ? 'bg-[#164A41] text-white shadow-2xs'
                : 'bg-[#F6F4EF] border border-[#DDE3DC] text-[#566775] hover:bg-[#E5EEE8] hover:text-[#164A41]'
            }`}
          >
            All Semesters
          </button>

          {Array.from({ length: Math.max(8, selectedSemester || 0) }, (_, index) => index + 1).map((sem) => (
            <button
              key={sem}
              type="button"
              onClick={() => handleSemesterSelect(sem)}
              aria-pressed={selectedSemester === sem}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold shrink-0 transition-colors ${
                selectedSemester === sem
                  ? 'bg-[#164A41] text-white shadow-2xs'
                  : 'bg-[#F6F4EF] border border-[#DDE3DC] text-[#566775] hover:bg-[#E5EEE8] hover:text-[#164A41]'
              }`}
            >
              {getSemesterOrdinal(sem)} Sem
            </button>
          ))}
        </div>
      </div>

      {/* Courses List */}
      {queryError ? (
        <ErrorMessage
          title="Invalid course URL"
          message={queryError}
          onRetry={() => handleSemesterSelect(null)}
          retryLabel="Clear semester filter"
        />
      ) : loading ? (
        <GridSkeleton count={6} />
      ) : error ? (
        <ErrorMessage message={error} onRetry={loadCourses} />
      ) : filteredCourses.length > 0 ? (
        <div className="space-y-12">
          <div className="flex items-center justify-between mb-4 text-xs font-medium text-[#566775] border-b border-[#DDE3DC] pb-3">
            <span>
              Showing <span className="font-semibold text-[#1D2933]">{filteredCourses.length}</span>{' '}
              {filteredCourses.length === 1 ? 'course' : 'courses'} across curriculum
            </span>
            {selectedSemester && (
              <button
                type="button"
                onClick={() => handleSemesterSelect(null)}
                className="text-[#164A41] hover:underline font-semibold"
              >
                Clear semester filter
              </button>
            )}
          </div>

          {ACADEMIC_YEARS.map((yearGroup) => {
            const yearSemesters = yearGroup.semesters
              .map((s) => {
                const semCourses = filteredCourses.filter((c) => c.semester === s.semester);
                const totalCredits = semCourses.reduce((sum, c) => sum + (c.credits || 0), 0);
                return { ...s, courses: semCourses, totalCredits };
              })
              .filter((s) => s.courses.length > 0);

            if (yearSemesters.length === 0) return null;

            const yearTotalCourses = yearSemesters.reduce((sum, s) => sum + s.courses.length, 0);
            const yearTotalCredits = yearSemesters.reduce((sum, s) => sum + s.totalCredits, 0);

            return (
              <section key={yearGroup.year} className="space-y-6">
                {/* Year Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#CBDAD0] pb-3">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#1D2933] tracking-tight flex items-center gap-2.5">
                    <GraduationCap className="w-6 h-6 text-[#164A41]" />
                    {yearGroup.title}
                  </h2>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="px-2.5 py-1 rounded-md bg-[#E5EEE8] text-[#164A41] border border-[#CBDAD0]">
                      {yearTotalCredits.toFixed(2)} Total Credits
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-[#F6F4EF] text-[#566775] border border-[#DDE3DC]">
                      {yearTotalCourses} {yearTotalCourses === 1 ? 'Course' : 'Courses'}
                    </span>
                  </div>
                </div>

                {/* Semesters in Year */}
                <div className="space-y-8 pl-0 sm:pl-1">
                  {yearSemesters.map((s) => (
                    <div key={s.semester} className="space-y-4">
                      {/* Semester Sub-header */}
                      <div className="bg-[#E5EEE8]/60 border border-[#CBDAD0] rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#C26B3D]" />
                          <h3 className="text-base sm:text-lg font-bold text-[#1D2933]">
                            {s.termLabel}
                          </h3>
                          <span className="text-xs font-medium text-[#566775]">
                            (Semester {s.semester})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-[#1D2933] bg-white border border-[#CBDAD0] px-2.5 py-1 rounded-md shadow-2xs">
                            Semester Credits: <span className="text-[#164A41] font-bold">{s.totalCredits.toFixed(2)}</span>
                          </span>
                          <span className="text-[#566775] font-medium">
                            {s.courses.length} {s.courses.length === 1 ? 'course' : 'courses'}
                          </span>
                        </div>
                      </div>

                      {/* Course Cards Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {s.courses.map((c) => (
                          <CourseCard key={c.id} course={c} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
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
              className="px-4 py-2 bg-[#164A41] hover:bg-[#103831] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors"
            >
              View All Courses
            </button>
          }
        />
      )}
    </div>
  );
}
