import { Link } from 'react-router-dom';
import { FileQuestion, Home, BookOpen, Files } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 sm:py-28 text-center flex flex-col items-center justify-center">
      <div className="w-20 h-20 rounded-2xl bg-[#E5EEE8] border border-[#CBDAD0] flex items-center justify-center text-[#164A41] mb-6 shadow-xs">
        <FileQuestion className="w-10 h-10" />
      </div>

      <div className="inline-block px-3 py-1 rounded-full bg-[#E5EEE8] text-[#164A41] border border-[#CBDAD0] font-mono text-xs font-bold mb-3">
        404 ERROR
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1D2933] tracking-tight mb-3">
        Page Not Found
      </h1>

      <p className="text-sm sm:text-base text-[#566775] max-w-md mx-auto mb-8 leading-relaxed">
        The academic resource, course, or page you are trying to reach doesn't exist or has been reorganized.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="px-5 py-2.5 bg-[#164A41] hover:bg-[#103831] text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-colors inline-flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          Back to Homepage
        </Link>
        <Link
          to="/courses"
          className="px-5 py-2.5 bg-white border border-[#DDE3DC] hover:bg-[#F6F4EF] text-[#1D2933] text-xs sm:text-sm font-semibold rounded-lg shadow-2xs transition-colors inline-flex items-center gap-2"
        >
          <BookOpen className="w-4 h-4 text-[#566775]" />
          Browse Courses
        </Link>
        <Link
          to="/library"
          className="px-5 py-2.5 bg-white border border-[#DDE3DC] hover:bg-[#F6F4EF] text-[#1D2933] text-xs sm:text-sm font-semibold rounded-lg shadow-2xs transition-colors inline-flex items-center gap-2"
        >
          <Files className="w-4 h-4 text-[#566775]" />
          Search Library
        </Link>
      </div>
    </div>
  );
}
