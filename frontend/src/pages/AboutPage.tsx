import { Link } from 'react-router-dom';
import {
  GraduationCap,
  ShieldCheck,
  BookOpen,
  Files,
  Upload,
  CheckCircle,
  Code2,
} from 'lucide-react';

export function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12 sm:space-y-16">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E5EEE8] text-[#164A41] text-xs font-semibold border border-[#CBDAD0]">
          <GraduationCap className="w-4 h-4" />
          <span>University Web Engineering Project</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1D2933] tracking-tight">
          About UniShare
        </h1>
        <p className="text-base sm:text-lg text-[#566775] leading-relaxed">
          An open, frictionless academic resource sharing platform engineered to democratize access to study materials for university students.
        </p>
      </div>

      {/* Mission & Purpose */}
      <section className="bg-white rounded-xl p-8 sm:p-10 border border-[#DDE3DC] shadow-xs space-y-6">
        <div className="border-b border-[#DDE3DC] pb-4">
          <h2 className="text-xl font-bold text-[#1D2933] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#164A41]" />
            Mission & Architecture
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-[#566775] leading-relaxed">
          <p>
            During university semesters, lecture slides, handwritten summaries, and past exam solutions are frequently scattered across private chats, expired drive links, or walled platforms. UniShare was engineered to bring order, structure, and open longevity to academic materials.
          </p>
          <p>
            Unlike conventional resource sites that force students through tedious account registrations, paywalls, or points systems, UniShare is <strong>100% open access</strong>. Any university student can immediately search, view, and download study resources without authenticating.
          </p>
        </div>
      </section>

      {/* Moderation Workflow */}
      <section className="bg-[#E5EEE8] rounded-xl p-8 sm:p-10 border border-[#CBDAD0] space-y-6">
        <div className="border-b border-[#CBDAD0] pb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[#164A41] block mb-1">
            Safe Community Contribution
          </span>
          <h2 className="text-xl font-bold text-[#1D2933] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#C26B3D]" />
            Moderated Note-Sharing Workflow
          </h2>
        </div>

        <p className="text-sm text-[#566775] leading-relaxed">
          To maintain high academic standards and prevent spam or malicious files without imposing student login friction, UniShare implements a secure asynchronous moderation pipeline:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-white p-5 rounded-lg border border-white shadow-xs">
            <div className="w-8 h-8 rounded-md bg-[#164A41] text-white flex items-center justify-center font-bold text-sm mb-3">
              1
            </div>
            <h3 className="font-bold text-[#1D2933] text-sm mb-1">Strict Validation</h3>
            <p className="text-xs text-[#566775] leading-relaxed">
              Uploaded files are strictly inspected for genuine PDF magic bytes, page trees, encryption flags, and maximum 10MB limits.
            </p>
          </div>

          <div className="bg-white p-5 rounded-lg border border-white shadow-xs">
            <div className="w-8 h-8 rounded-md bg-[#164A41] text-white flex items-center justify-center font-bold text-sm mb-3">
              2
            </div>
            <h3 className="font-bold text-[#1D2933] text-sm mb-1">Private Staging</h3>
            <p className="text-xs text-[#566775] leading-relaxed">
              Submissions are staged in a private quarantine directory marked as <code className="bg-[#F6F4EF] px-1 py-0.5 rounded text-[#164A41]">pending</code>, completely unexposed to the public catalog.
            </p>
          </div>

          <div className="bg-white p-5 rounded-lg border border-white shadow-xs">
            <div className="w-8 h-8 rounded-md bg-[#C26B3D] text-white flex items-center justify-center font-bold text-sm mb-3">
              3
            </div>
            <h3 className="font-bold text-[#1D2933] text-sm mb-1">Maintainer CLI Review</h3>
            <p className="text-xs text-[#566775] leading-relaxed">
              Course maintainers review submissions via a secure local command-line interface (<code className="bg-[#F6F4EF] px-1 py-0.5 rounded text-[#164A41]">review_submissions.py</code>) to approve or reject.
            </p>
          </div>
        </div>
      </section>

      {/* Curriculum Coverage & Tech Stack */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Curriculum Specs */}
        <div className="bg-white rounded-xl p-6 sm:p-8 border border-[#DDE3DC] shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#164A41]" />
            <h3 className="text-lg font-bold text-[#1D2933]">Curriculum Coverage</h3>
          </div>
          <p className="text-sm text-[#566775] leading-relaxed">
            UniShare models the full, accredited Computer Science & Engineering degree curriculum across all four academic years:
          </p>
          <ul className="space-y-2 text-xs text-[#1D2933]">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#164A41]" />
              <span><strong>8 Semesters</strong> spanning Year 1 to Year 4</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#164A41]" />
              <span><strong>78 Official Courses</strong> with verified course codes & names</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#164A41]" />
              <span><strong>161.0 Total Credits</strong> accurately tallied per semester</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#164A41]" />
              <span><strong>5 Categorized Material Types</strong> (Notes, Past Papers, Labs, Books, Syllabus)</span>
            </li>
          </ul>
        </div>

        {/* Tech Stack Specs */}
        <div className="bg-white rounded-xl p-6 sm:p-8 border border-[#DDE3DC] shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-[#164A41]" />
            <h3 className="text-lg font-bold text-[#1D2933]">Technology Stack</h3>
          </div>
          <p className="text-sm text-[#566775] leading-relaxed">
            Built using modern, lightweight full-stack web engineering standards:
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[#F6F4EF] rounded-lg border border-[#DDE3DC]">
              <span className="font-bold text-[#164A41] block">Backend</span>
              <span className="text-[#566775]">FastAPI &bull; Python 3.12</span>
            </div>
            <div className="p-3 bg-[#F6F4EF] rounded-lg border border-[#DDE3DC]">
              <span className="font-bold text-[#164A41] block">Database</span>
              <span className="text-[#566775]">SQLAlchemy 2.0 &bull; SQLite</span>
            </div>
            <div className="p-3 bg-[#F6F4EF] rounded-lg border border-[#DDE3DC]">
              <span className="font-bold text-[#164A41] block">Frontend</span>
              <span className="text-[#566775]">React 19 &bull; TypeScript &bull; Vite</span>
            </div>
            <div className="p-3 bg-[#F6F4EF] rounded-lg border border-[#DDE3DC]">
              <span className="font-bold text-[#164A41] block">Styling</span>
              <span className="text-[#566775]">Tailwind CSS v4</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Callouts */}
      <div className="border-t border-[#DDE3DC] pt-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-sm text-[#1D2933]">Ready to explore?</h4>
          <p className="text-xs text-[#566775]">Start browsing courses or search the academic library.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/courses"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#164A41] text-white text-xs font-semibold hover:bg-[#103831] transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Browse Courses
          </Link>
          <Link
            to="/library"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#E5EEE8] text-[#164A41] text-xs font-semibold hover:bg-[#CBDAD0] border border-[#CBDAD0] transition-colors"
          >
            <Files className="w-3.5 h-3.5" />
            Open Library
          </Link>
          <Link
            to="/contribute"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C26B3D] text-white text-xs font-semibold hover:bg-[#A5552D] transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Share Notes
          </Link>
        </div>
      </div>
    </div>
  );
}
