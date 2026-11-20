import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  BookOpen,
  Files,
  Upload,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  FileText,
  Share2,
} from 'lucide-react';
import { MAX_SEARCH_LENGTH } from '../utils/queryParams';

export function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/library?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/library');
    }
  };

  return (
    <div className="space-y-12 sm:space-y-16 pb-12">
      {/* Hero Section — Light warm off-white background with subtle border */}
      <section className="bg-[#F8FAF8] border-b border-[#DDE3DC] pt-10 sm:pt-14 pb-12 sm:pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          {/* Soft Sage Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E5EEE8] border border-[#CBDAD0] text-[#164A41] text-xs font-semibold mb-5 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-[#164A41]" />
            <span>Open Academic Resource Library &bull; No Login Required</span>
          </div>

          {/* Main Headline in Dark Charcoal with Forest Green Accent */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1D2933] tracking-tight leading-[1.2] mb-4">
            The University Academic Library, <br className="hidden sm:inline" />
            Built for <span className="text-[#164A41]">Open Learning</span>
          </h1>

          {/* Supporting Description */}
          <p className="text-sm sm:text-base text-[#566775] max-w-2xl mx-auto mb-6 leading-relaxed">
            Discover verified course notes, past exams, and study guides aligned with the official degree curriculum. Freely read, preview, and download without account barriers.
          </p>

          {/* Prominent White Search Form */}
          <form
            onSubmit={handleSearch}
            className="max-w-2xl mx-auto mb-6 relative flex flex-col sm:flex-row items-center gap-2 bg-white p-1.5 sm:p-2 rounded-xl shadow-xs border border-[#DDE3DC] focus-within:border-[#164A41] focus-within:ring-2 focus-within:ring-[#164A41]/20 transition-all"
          >
            <div className="relative flex-1 w-full flex items-center">
              <Search className="absolute left-3.5 w-4 h-4 text-[#566775] pointer-events-none" />
              <input
                type="search"
                aria-label="Search resources and courses"
                maxLength={MAX_SEARCH_LENGTH}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search courses or topics (e.g., Operating Systems, CSE 3101, SQL)..."
                className="w-full pl-10 pr-4 py-2 text-sm sm:text-base bg-transparent text-[#1D2933] placeholder:text-[#566775] focus:outline-hidden"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2.5 bg-[#164A41] hover:bg-[#103831] text-white font-semibold text-sm rounded-lg shadow-xs transition-colors shrink-0 inline-flex items-center justify-center gap-1.5"
            >
              Search
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Main Hero Actions: Explore Library & Browse Courses */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/library"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#164A41] hover:bg-[#103831] text-white font-semibold text-sm shadow-xs transition-all"
            >
              <Files className="w-4 h-4" />
              Explore Library
            </Link>

            <Link
              to="/courses"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white hover:bg-[#E5EEE8] border border-[#DDE3DC] hover:border-[#CBDAD0] text-[#1D2933] hover:text-[#164A41] font-semibold text-sm shadow-2xs transition-all"
            >
              <BookOpen className="w-4 h-4 text-[#566775]" />
              Browse Courses
            </Link>
          </div>

          {/* Small Secondary Contribution Link */}
          <p className="mt-4 text-xs text-[#566775]">
            Have lecture notes or exam prep to share?{' '}
            <Link
              to="/contribute"
              className="font-semibold text-[#164A41] hover:text-[#103831] underline underline-offset-2 inline-flex items-center gap-1"
            >
              <Upload className="w-3.5 h-3.5" />
              Contribute your study materials
            </Link>
          </p>
        </div>
      </section>

      {/* How UniShare Works Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[#164A41] mb-1.5 block">
            Frictionless & Moderated
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1D2933] tracking-tight">
            How UniShare Works
          </h2>
          <p className="text-sm text-[#566775] mt-1.5">
            A focused learning repository engineered specifically for university coursework.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Step 1 */}
          <div className="bg-white rounded-xl p-6 sm:p-7 border border-[#DDE3DC] shadow-2xs hover:border-[#CBDAD0] transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#E5EEE8] text-[#164A41] flex items-center justify-center font-bold text-base mb-4">
              1
            </div>
            <div className="flex items-center gap-2 mb-2.5">
              <BookOpen className="w-4 h-4 text-[#164A41]" />
              <h3 className="text-base font-bold text-[#1D2933]">
                Browse by Curriculum
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#566775] leading-relaxed">
              Explore courses structured across the official 8-semester Computer Science curriculum, organized by academic year with official codes and credit weights.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-xl p-6 sm:p-7 border border-[#DDE3DC] shadow-2xs hover:border-[#CBDAD0] transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#E5EEE8] text-[#164A41] flex items-center justify-center font-bold text-base mb-4">
              2
            </div>
            <div className="flex items-center gap-2 mb-2.5">
              <FileText className="w-4 h-4 text-[#164A41]" />
              <h3 className="text-base font-bold text-[#1D2933]">
                Instant Study & Download
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#566775] leading-relaxed">
              Preview documents directly in your browser or download PDFs in one click. No mandatory login, passwords, or artificial barriers.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-xl p-6 sm:p-7 border border-[#DDE3DC] shadow-2xs hover:border-[#CBDAD0] transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#E5EEE8] text-[#164A41] flex items-center justify-center font-bold text-base mb-4">
              3
            </div>
            <div className="flex items-center gap-2 mb-2.5">
              <Share2 className="w-4 h-4 text-[#164A41]" />
              <h3 className="text-base font-bold text-[#1D2933]">
                Share With Moderation
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#566775] leading-relaxed">
              Submit your own lecture notes and study guides. Submissions enter a secure staging queue and are reviewed by course maintainers before public cataloging.
            </p>
          </div>
        </div>
      </section>

      {/* Core Principles Section — Soft Sage background */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="bg-[#E5EEE8] rounded-2xl p-6 sm:p-10 border border-[#CBDAD0]">
          <div className="max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-wider text-[#164A41] mb-1.5 block">
              Academic Integrity & Access
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1D2933] mb-3">
              Designed for Students, Governed with Care
            </h2>
            <p className="text-xs sm:text-sm text-[#566775] leading-relaxed mb-6">
              UniShare eliminates fragmented study materials scattered across group chats and temporary drive links. Everything is cataloged around verified academic terms.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex items-start gap-3 bg-white/80 p-3.5 rounded-xl border border-white">
                <CheckCircle className="w-4 h-4 text-[#164A41] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-[#1D2933]">Zero Login Friction</h4>
                  <p className="text-[11px] text-[#566775] mt-0.5">
                    Equal, unhindered access to academic materials for all students without registration.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white/80 p-3.5 rounded-xl border border-white">
                <CheckCircle className="w-4 h-4 text-[#164A41] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-[#1D2933]">Verified Curriculum Structure</h4>
                  <p className="text-[11px] text-[#566775] mt-0.5">
                    Organized across all 78 courses and 8 semesters, ensuring relevance to course syllabi.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white/80 p-3.5 rounded-xl border border-white">
                <CheckCircle className="w-4 h-4 text-[#164A41] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-[#1D2933]">Quality Moderation Pipeline</h4>
                  <p className="text-[11px] text-[#566775] mt-0.5">
                    Uploads are strictly verified for authentic PDF structure and approved via maintainer CLI.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white/80 p-3.5 rounded-xl border border-white">
                <CheckCircle className="w-4 h-4 text-[#164A41] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-[#1D2933]">Fast & Lightweight</h4>
                  <p className="text-[11px] text-[#566775] mt-0.5">
                    Built with modern React and FastAPI for near-instant search and rapid document delivery.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supporting Callout Section — Soft Sage Background instead of dark green */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="bg-[#E5EEE8] border border-[#CBDAD0] rounded-2xl p-8 sm:p-10 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1D2933] mb-2.5">
              Have Notes or Past Papers to Share?
            </h2>
            <p className="text-xs sm:text-sm text-[#566775] mb-6 leading-relaxed">
              Help your peers prepare for upcoming semesters. Upload your lecture summaries or exam solutions in seconds for maintainer review.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/contribute"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#164A41] hover:bg-[#103831] text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors"
              >
                <Upload className="w-4 h-4" />
                Share Your Notes
              </Link>
              <Link
                to="/courses"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white hover:bg-[#F6F4EF] border border-[#CBDAD0] text-[#1D2933] font-semibold text-xs sm:text-sm shadow-2xs transition-colors"
              >
                <BookOpen className="w-4 h-4 text-[#566775]" />
                Browse Course Catalog
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
