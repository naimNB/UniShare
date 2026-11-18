import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { BookOpen, GraduationCap, Search, Library } from 'lucide-react'

function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-indigo-600" />
            <span className="text-xl font-bold tracking-tight text-slate-900">UniShare</span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-indigo-600 transition-colors">
              Home
            </Link>
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
              Academic Resource Platform
            </span>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 py-16 text-center flex flex-col items-center justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-6 border border-indigo-200">
          <Library className="w-4 h-4" />
          University Resource Sharing Platform
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          UniShare
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mb-8 leading-relaxed">
          Open academic resource library. Browse university courses by semester, search study materials, preview PDFs, and download notes freely without signing in.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl text-left">
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <BookOpen className="w-5 h-5 text-indigo-600 mb-2" />
            <h3 className="font-semibold text-slate-900 text-sm">Course Directory</h3>
            <p className="text-xs text-slate-500 mt-1">Organized semester-by-semester curriculum resources</p>
          </div>
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <Search className="w-5 h-5 text-indigo-600 mb-2" />
            <h3 className="font-semibold text-slate-900 text-sm">Instant Search</h3>
            <p className="text-xs text-slate-500 mt-1">Find lecture notes, lab manuals, and past exams</p>
          </div>
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <GraduationCap className="w-5 h-5 text-indigo-600 mb-2" />
            <h3 className="font-semibold text-slate-900 text-sm">Direct Access</h3>
            <p className="text-xs text-slate-500 mt-1">Zero barrier study library with inline PDF preview</p>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} UniShare — Open Academic Resource Library
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  )
}
