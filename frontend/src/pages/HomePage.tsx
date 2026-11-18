import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  BookOpen,
  Files,
  ArrowRight,
  Sparkles,
  Layers,
  GraduationCap,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../api/client';
import type { Category, Course, Resource } from '../types/api';
import { ResourceCard } from '../components/ResourceCard';
import { CourseCard } from '../components/CourseCard';
import { GridSkeleton } from '../components/LoadingSkeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { getSemesterOrdinal } from '../utils/formatters';

export function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentResources, setRecentResources] = useState<Resource[]>([]);
  const [totalResourcesCount, setTotalResourcesCount] = useState<number>(0);
  const [selectedSemester, setSelectedSemester] = useState<number>(5); // default semester 5 (DBMS & OS)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [coursesRes, categoriesRes, resourcesRes] = await Promise.all([
        api.getCourses(),
        api.getCategories(),
        api.getResources({ limit: 6 }),
      ]);

      setCourses(coursesRes);
      setCategories(categoriesRes);
      setRecentResources(resourcesRes.items);
      setTotalResourcesCount(resourcesRes.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/resources?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/resources');
    }
  };

  // Filter courses for the selected semester tab
  const semesterCourses = courses.filter((c) => c.semester === selectedSemester);

  return (
    <div className="space-y-16 sm:space-y-24 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white border-b border-slate-200/80 pt-12 sm:pt-20 pb-16 sm:pb-24">
        {/* Subtle background decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none opacity-40 overflow-hidden">
          <div className="absolute -top-24 right-10 w-96 h-96 bg-indigo-100 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-20 w-80 h-80 bg-sky-100 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-6 shadow-2xs">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            University Academic Resource Library
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1] mb-6">
            Find and Share Study Materials <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-sky-600">
              Without Barriers
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
            Access verified lecture notes, laboratory manuals, past exam papers, and official syllabi across all semesters. No logins, accounts, or paywalls.
          </p>

          {/* Search Bar Form */}
          <form
            onSubmit={handleSearch}
            className="max-w-2xl mx-auto mb-8 relative flex flex-col sm:flex-row items-center gap-2 bg-white p-2 rounded-2xl border-2 border-indigo-100 shadow-md focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100 transition-all"
          >
            <div className="relative flex-1 w-full flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search courses, topics (e.g. Relational DBMS, Sockets, AVL Trees)..."
                className="w-full pl-12 pr-4 py-3 text-sm sm:text-base bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-xs hover:shadow-md transition-all shrink-0 inline-flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              Search Library
            </button>
          </form>

          {/* Quick Search Tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">Quick Searches:</span>
            {[
              'Database Systems',
              'Operating Systems',
              'Web Engineering',
              'Data Structures',
              'Past Questions',
            ].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => navigate(`/resources?q=${encodeURIComponent(tag)}`)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-transparent rounded-lg font-medium transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Real Statistics Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 sm:-mt-12">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <div className="text-3xl sm:text-4xl font-extrabold text-indigo-600">
              {loading ? '...' : courses.length}
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-800">
              Curated Courses
            </div>
            <div className="text-[11px] text-slate-500">Semesters 1 through 8</div>
          </div>

          <div className="space-y-1 border-l border-slate-100">
            <div className="text-3xl sm:text-4xl font-extrabold text-indigo-600">
              {loading ? '...' : totalResourcesCount}
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-800">
              Verified Materials
            </div>
            <div className="text-[11px] text-slate-500">PDFs, notes & manuals</div>
          </div>

          <div className="space-y-1 border-l border-slate-100">
            <div className="text-3xl sm:text-4xl font-extrabold text-indigo-600">
              {loading ? '...' : categories.length}
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-800">
              Resource Categories
            </div>
            <div className="text-[11px] text-slate-500">Exams, notes, labs & guides</div>
          </div>

          <div className="space-y-1 border-l border-slate-100">
            <div className="text-3xl sm:text-4xl font-extrabold text-emerald-600 inline-flex items-center gap-1 justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 inline" />
              Open
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-800">
              Zero Login Required
            </div>
            <div className="text-[11px] text-slate-500">Immediate public downloads</div>
          </div>
        </div>
      </section>

      {/* Error display if fetch failed */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ErrorMessage message={error} onRetry={loadData} />
        </div>
      )}

      {/* Category Showcase Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
              Resource Classification
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Explore by Academic Category
            </h2>
          </div>
          <Link
            to="/resources"
            className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            All Resources <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <GridSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/resources?category_id=${cat.id}`}
                className="group p-5 bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-base mb-1">
                    {cat.name}
                  </h3>
                  {cat.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                      {cat.description}
                    </p>
                  )}
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>{cat.resource_count} documents</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Semester Course Exploration */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
              Curriculum Organization
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Browse Courses by Semester
            </h2>
          </div>
          <Link
            to="/courses"
            className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            All Courses Directory <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Semester selector tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-6 scrollbar-none">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
            <button
              key={sem}
              type="button"
              onClick={() => setSelectedSemester(sem)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shrink-0 transition-all ${
                selectedSemester === sem
                  ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-200'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {getSemesterOrdinal(sem)} Semester
            </button>
          ))}
        </div>

        {/* Courses in selected semester */}
        {loading ? (
          <GridSkeleton count={2} />
        ) : semesterCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {semesterCourses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm">
            No courses configured for this semester yet.
          </div>
        )}
      </section>

      {/* Recent & Featured Resources */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
              Latest Additions
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Recently Uploaded Academic Materials
            </h2>
          </div>
          <Link
            to="/resources"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Explore Library ({totalResourcesCount}) <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <GridSkeleton count={6} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentResources.map((res) => (
              <ResourceCard key={res.id} resource={res} />
            ))}
          </div>
        )}
      </section>

      {/* Zero Barrier Call to Action */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 sm:p-14 text-white text-center relative overflow-hidden shadow-xl">
          <div className="relative max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-400/30">
              <GraduationCap className="w-4 h-4" />
              University Resource Repository
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Study Smarter with Open Resources
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              Directly view lecture slides, reference guides, and past exams in your browser with our responsive PDF viewer. No accounts, no subscriptions.
            </p>
            <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/resources"
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-md transition-colors inline-flex items-center gap-2"
              >
                <Files className="w-4 h-4" />
                Browse All Resources
              </Link>
              <Link
                to="/courses"
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-xl backdrop-blur-xs transition-colors inline-flex items-center gap-2 border border-white/10"
              >
                <BookOpen className="w-4 h-4" />
                Browse by Semester
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
