import { Link } from 'react-router-dom';
import { GraduationCap, ShieldCheck, Heart } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="border-t border-[#CBDAD0] bg-[#103831] text-[#E5EEE8] text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <Link
              to="/"
              className="flex items-center gap-2.5 text-white font-bold text-lg"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[#F6F4EF] text-[#164A41]">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span>UniShare</span>
            </Link>
            <p className="text-xs text-[#CBDAD0] leading-relaxed max-w-md">
              A community academic resource platform for university students. Browse official curriculum courses, access lecture materials, and safely share verified study notes without account barriers.
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#164A41] text-[#E5EEE8] text-[11px] font-medium border border-[#205C52]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C26B3D]" />
              Moderated Open Access &bull; No Login Required
            </div>
          </div>

          {/* Quick Navigation */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
              Navigation
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/" className="text-[#CBDAD0] hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/courses" className="text-[#CBDAD0] hover:text-white transition-colors">
                  Curriculum Courses
                </Link>
              </li>
              <li>
                <Link to="/library" className="text-[#CBDAD0] hover:text-white transition-colors">
                  Resource Library
                </Link>
              </li>
              <li>
                <Link to="/contribute" className="text-[#CBDAD0] hover:text-white transition-colors">
                  Share Your Notes
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-[#CBDAD0] hover:text-white transition-colors">
                  About UniShare
                </Link>
              </li>
            </ul>
          </div>

          {/* University Project Notice */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
              About Project
            </h3>
            <p className="text-xs text-[#CBDAD0] leading-relaxed mb-3">
              Developed as a university Web Engineering academic project. Engineered with FastAPI, SQLite, React, and TypeScript.
            </p>
            <div className="text-[11px] text-[#CBDAD0]">
              CSE Curriculum &bull; 8 Semesters &bull; 78 Courses
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-[#164A41] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#CBDAD0]">
          <p>
            &copy; {CURRENT_YEAR} UniShare — University Resource Sharing Platform. All academic content shared for educational purposes.
          </p>
          <p className="inline-flex items-center gap-1">
            Built with <Heart className="w-3.5 h-3.5 text-[#C26B3D] fill-[#C26B3D]" /> for university students
          </p>
        </div>
      </div>
    </footer>
  );
}
