import { Link } from 'react-router-dom';
import { GraduationCap, ShieldCheck, Heart, ArrowUpRight } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

export function Footer() {

  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Info */}
          <div className="md:col-span-1 space-y-3">
            <Link
              to="/"
              className="flex items-center gap-2 text-slate-900 font-bold text-lg"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span>UniShare</span>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed">
              Open university academic library. Designed to help students discover, preview, and download course documents freely without sign-up barriers.
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% Free & Open Access
            </div>
          </div>

          {/* Quick Navigation */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Platform Navigation
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/" className="hover:text-indigo-600 transition-colors">
                  Home Overview
                </Link>
              </li>
              <li>
                <Link to="/courses" className="hover:text-indigo-600 transition-colors">
                  Course Directory
                </Link>
              </li>
              <li>
                <Link to="/resources" className="hover:text-indigo-600 transition-colors">
                  Full Resource Library
                </Link>
              </li>
              <li>
                <Link to="/resources?category_id=3" className="hover:text-indigo-600 transition-colors">
                  Past Exam Papers
                </Link>
              </li>
            </ul>
          </div>

          {/* Semesters */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Explore by Semester
            </h3>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <Link
                  key={sem}
                  to={`/courses?semester=${sem}`}
                  className="hover:text-indigo-600 transition-colors inline-flex items-center gap-1"
                >
                  Semester {sem}
                  <ArrowUpRight className="w-3 h-3 text-slate-400" />
                </Link>
              ))}
            </div>
          </div>

          {/* Project Details */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Engineering Project
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              UniShare is engineered for the University Web Engineering curriculum. Read-only REST architecture with SQLite & FastAPI backend.
            </p>
            <div className="text-[11px] text-slate-400">
              Platform status:{' '}
              <span className="text-emerald-600 font-medium">All APIs Operational</span>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            &copy; {CURRENT_YEAR} UniShare — University Resource Sharing Platform. Built with React & FastAPI.
          </p>
          <p className="inline-flex items-center gap-1">
            Engineered with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> for university students
          </p>
        </div>
      </div>
    </footer>
  );
}
