import { Link } from 'react-router-dom';
import { FileQuestion, Home, BookOpen, Files } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 sm:py-28 text-center flex flex-col items-center justify-center">
      <div className="w-20 h-20 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-6 shadow-xs">
        <FileQuestion className="w-10 h-10" />
      </div>

      <div className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-mono text-xs font-bold mb-3">
        404 ERROR
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
        Page Not Found
      </h1>

      <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto mb-8 leading-relaxed">
        The academic resource, course, or page you are trying to reach doesn't exist or has been reorganized.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors inline-flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          Back to Homepage
        </Link>
        <Link
          to="/courses"
          className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl shadow-2xs transition-colors inline-flex items-center gap-2"
        >
          <BookOpen className="w-4 h-4 text-slate-400" />
          Browse Courses
        </Link>
        <Link
          to="/resources"
          className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl shadow-2xs transition-colors inline-flex items-center gap-2"
        >
          <Files className="w-4 h-4 text-slate-400" />
          Search Library
        </Link>
      </div>
    </div>
  );
}
