import { useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  BookOpen,
  Files,
  Upload,
  Info,
  Search,
  Menu,
  X,
} from 'lucide-react';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickQuery.trim()) {
      navigate(`/library?q=${encodeURIComponent(quickQuery.trim())}`);
      setQuickQuery('');
      setMobileMenuOpen(false);
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-[#103831] text-white font-semibold shadow-xs'
        : 'text-[#E5EEE8] hover:text-white hover:bg-white/10'
    }`;

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3.5 py-2.5 rounded-md text-base font-medium transition-colors ${
      isActive
        ? 'bg-[#103831] text-white font-semibold'
        : 'text-[#E5EEE8] hover:text-white hover:bg-white/10'
    }`;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#103831] bg-[#164A41] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3 sm:gap-4">
          {/* Brand Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#CBDAD0] rounded-lg group shrink-0"
            aria-label="UniShare Home"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#F6F4EF] text-[#164A41] shadow-xs group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                UniShare
                <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-[#E5EEE8]/20 text-[#E5EEE8] border border-white/20 rounded">
                  Open
                </span>
              </span>
              <span className="text-[11px] font-medium text-[#E5EEE8]/80 hidden sm:block">
                Academic Resource Library
              </span>
            </div>
          </Link>

          {/* Desktop Search Bar (hidden on homepage to prevent search bar duplication) */}
          {!isHomePage && (
            <form
              onSubmit={handleQuickSearch}
              className="hidden md:flex flex-1 max-w-xs lg:max-w-md mx-2 relative items-center"
            >
              <label htmlFor="navbar-search" className="sr-only">
                Quick search resources
              </label>
              <Search className="absolute left-3 w-4 h-4 text-[#CBDAD0] pointer-events-none" />
              <input
                id="navbar-search"
                type="search"
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder="Search courses, past papers, notes..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-[#103831] border border-[#205C52] rounded-md focus:bg-[#0c2a25] focus:border-[#CBDAD0] focus:outline-hidden focus:ring-2 focus:ring-[#CBDAD0]/40 transition-all text-white placeholder:text-[#CBDAD0]"
              />
            </form>
          )}

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/courses" className={navLinkClass}>
              <BookOpen className="w-4 h-4" />
              Courses
            </NavLink>
            <NavLink to="/library" className={navLinkClass}>
              <Files className="w-4 h-4" />
              Library
            </NavLink>
            <NavLink to="/contribute" className={navLinkClass}>
              <Upload className="w-4 h-4" />
              Contribute
            </NavLink>
            <NavLink to="/about" className={navLinkClass}>
              <Info className="w-4 h-4" />
              About
            </NavLink>
          </nav>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-[#E5EEE8] hover:text-white hover:bg-white/10 focus:outline-hidden focus:ring-2 focus:ring-[#CBDAD0]"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#103831] bg-[#164A41] px-4 pt-2 pb-5 space-y-3">
          {!isHomePage && (
            <form onSubmit={handleQuickSearch} className="relative mt-2">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#CBDAD0]" />
              <input
                type="search"
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder="Search resources..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-[#103831] border border-[#205C52] rounded-md text-white placeholder:text-[#CBDAD0] focus:outline-hidden focus:ring-2 focus:ring-[#CBDAD0]"
              />
            </form>
          )}
          <nav className="flex flex-col gap-1 pt-1" aria-label="Mobile Navigation">
            <NavLink
              to="/"
              end
              className={mobileNavLinkClass}
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </NavLink>
            <NavLink
              to="/courses"
              className={mobileNavLinkClass}
              onClick={() => setMobileMenuOpen(false)}
            >
              <BookOpen className="w-4 h-4 text-[#CBDAD0]" />
              Courses by Semester
            </NavLink>
            <NavLink
              to="/library"
              className={mobileNavLinkClass}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Files className="w-4 h-4 text-[#CBDAD0]" />
              Academic Library
            </NavLink>
            <NavLink
              to="/contribute"
              className={mobileNavLinkClass}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Upload className="w-4 h-4 text-[#CBDAD0]" />
              Contribute Notes
            </NavLink>
            <NavLink
              to="/about"
              className={mobileNavLinkClass}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Info className="w-4 h-4 text-[#CBDAD0]" />
              About UniShare
            </NavLink>
          </nav>
        </div>
      )}
    </header>
  );
}
