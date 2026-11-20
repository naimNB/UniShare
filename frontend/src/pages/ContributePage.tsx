import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Upload,
  AlertCircle,
  CheckCircle2,
  FileText,
  ShieldCheck,
  X,
  Loader2,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Course, Category, SubmissionCreateResponse } from '../types/api';
import { getSemesterLabel } from '../utils/formatters';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function ContributePage() {
  const [searchParams] = useSearchParams();
  const preselectedCourseId = searchParams.get('course_id');

  // Form State
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);

  const [selectedYear, setSelectedYear] = useState<number>(1);
  const [selectedSemester, setSelectedSemester] = useState<number>(1);
  const [selectedCourseId, setSelectedCourseId] = useState<number | ''>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contributorName, setContributorName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);

  // Submission Status
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SubmissionCreateResponse | null>(null);

  // Load initial courses and categories
  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        setLoadingInitial(true);
        setInitialError(null);
        const [courseList, categoryList] = await Promise.all([
          api.getCourses(),
          api.getCategories(),
        ]);
        if (!active) return;
        setCourses(courseList);
        setCategories(categoryList);

        // Handle preselected course
        if (preselectedCourseId) {
          const cId = parseInt(preselectedCourseId, 10);
          const found = courseList.find((c) => c.id === cId);
          if (found) {
            setSelectedYear(found.year || Math.ceil(found.semester / 2));
            setSelectedSemester(found.semester);
            setSelectedCourseId(found.id);
          }
        } else if (courseList.length > 0) {
          // Default to first semester courses
          const sem1Courses = courseList.filter((c) => c.semester === 1);
          if (sem1Courses.length > 0) {
            setSelectedCourseId(sem1Courses[0].id);
          }
        }

        if (categoryList.length > 0) {
          setSelectedCategoryId(categoryList[0].id);
        }
      } catch (err) {
        if (!active) return;
        setInitialError(
          err instanceof Error ? err.message : 'Failed to load curriculum courses'
        );
      } finally {
        if (active) setLoadingInitial(false);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, [preselectedCourseId]);

  // Derived semester options based on year
  const availableSemesters = useMemo(() => {
    const sem1 = (selectedYear - 1) * 2 + 1;
    const sem2 = sem1 + 1;
    return [sem1, sem2];
  }, [selectedYear]);

  // Update semester when year changes if current semester is out of range
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    const newSem1 = (year - 1) * 2 + 1;
    setSelectedSemester(newSem1);
    const validCourses = courses.filter((c) => c.semester === newSem1);
    setSelectedCourseId(validCourses.length > 0 ? validCourses[0].id : '');
  };

  const handleSemesterChange = (sem: number) => {
    setSelectedSemester(sem);
    const validCourses = courses.filter((c) => c.semester === sem);
    setSelectedCourseId(validCourses.length > 0 ? validCourses[0].id : '');
  };

  // Filtered courses for current semester
  const semesterCourses = useMemo(() => {
    return courses
      .filter((c) => c.semester === selectedSemester)
      .sort((a, b) => a.display_order - b.display_order);
  }, [courses, selectedSemester]);

  // File selection & validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSubmitError(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.pdf') && selectedFile.type !== 'application/pdf') {
      setSubmitError('Only PDF documents (.pdf) are supported.');
      setFile(null);
      e.target.value = '';
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (selectedFile.size / (1024 * 1024)).toFixed(1);
      setSubmitError(`File size (${sizeMB} MB) exceeds the maximum allowed 10 MB limit.`);
      setFile(null);
      e.target.value = '';
      return;
    }

    if (selectedFile.size === 0) {
      setSubmitError('The selected file is empty.');
      setFile(null);
      e.target.value = '';
      return;
    }

    setFile(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!selectedCourseId) {
      setSubmitError('Please select a course.');
      return;
    }
    if (!selectedCategoryId) {
      setSubmitError('Please select a resource category.');
      return;
    }
    if (!title.trim() || title.trim().length < 3) {
      setSubmitError('Please enter a descriptive title (at least 3 characters).');
      return;
    }
    if (!file) {
      setSubmitError('Please select a valid PDF file to upload.');
      return;
    }
    if (!consent) {
      setSubmitError('You must confirm that you have permission to share these materials.');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('course_id', selectedCourseId.toString());
      formData.append('category_id', selectedCategoryId.toString());
      formData.append('consent', 'true');
      formData.append('file', file);
      if (description.trim()) {
        formData.append('description', description.trim());
      }
      if (contributorName.trim()) {
        formData.append('contributor_name', contributorName.trim());
      }

      const res = await api.submitResource(formData);
      setSuccessData(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.detail || err.message);
      } else {
        setSubmitError(
          err instanceof Error ? err.message : 'An error occurred during submission.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setContributorName('');
    setFile(null);
    setConsent(false);
    setSubmitError(null);
    setSuccessData(null);
  };

  if (loadingInitial) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Loader2 className="w-8 h-8 text-[#164A41] animate-spin mx-auto mb-4" />
        <p className="text-sm text-[#566775]">Loading course curriculum...</p>
      </div>
    );
  }

  if (initialError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-red-900 mb-2">Unable to Load Curriculum</h2>
          <p className="text-sm text-red-700 mb-4">{initialError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#164A41] text-white text-sm font-semibold rounded-lg hover:bg-[#103831]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5EEE8] text-[#164A41] text-xs font-semibold border border-[#CBDAD0]">
          <Upload className="w-3.5 h-3.5 text-[#C26B3D]" />
          <span>Peer Study Contributions</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D2933]">
          Share Your Notes & Study Materials
        </h1>
        <p className="text-sm text-[#566775] max-w-xl mx-auto leading-relaxed">
          Help fellow university students by sharing lecture notes, lab manuals, and exam preparation guides. All uploads are screened and reviewed before public display.
        </p>
      </div>

      {/* Moderation Notice Banner */}
      <div className="bg-[#E5EEE8] border border-[#CBDAD0] rounded-xl p-4 sm:p-5 flex items-start gap-3.5">
        <ShieldCheck className="w-5 h-5 text-[#164A41] shrink-0 mt-0.5" />
        <div className="text-xs text-[#1D2933] space-y-1">
          <p className="font-bold">Moderated Publishing Queue</p>
          <p className="text-[#566775] leading-relaxed">
            UniShare does not require an account to contribute. To keep the catalog accurate and safe, your upload will be staged privately and verified by a maintainer before appearing in the public library.
          </p>
        </div>
      </div>

      {/* Success Modal / State */}
      {successData ? (
        <div className="bg-white rounded-2xl p-8 sm:p-10 border border-[#DDE3DC] shadow-sm text-center space-y-6 animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-full bg-[#E5EEE8] text-[#164A41] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-[#164A41]" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1D2933]">
              Submission Received!
            </h2>
            <p className="text-sm font-semibold text-[#164A41]">
              Reference #{successData.id}: &ldquo;{successData.title}&rdquo;
            </p>
            <p className="text-xs text-[#566775] max-w-md mx-auto leading-relaxed">
              {successData.message} It is now safely stored in the moderation queue. Thank you for helping your university peers!
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={resetForm}
              className="px-5 py-2.5 rounded-lg bg-[#164A41] text-white font-semibold text-xs hover:bg-[#103831] transition-colors"
            >
              Submit Another Resource
            </button>
            <Link
              to="/library"
              className="px-5 py-2.5 rounded-lg bg-[#E5EEE8] text-[#164A41] font-semibold text-xs hover:bg-[#CBDAD0] border border-[#CBDAD0] transition-colors"
            >
              Explore Library
            </Link>
          </div>
        </div>
      ) : (
        /* Contribution Form */
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-6 sm:p-8 border border-[#DDE3DC] shadow-xs space-y-6"
        >
          {submitError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{submitError}</div>
            </div>
          )}

          {/* Academic Placement: Year & Semester */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[#566775] block">
              1. Academic Placement
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Academic Year */}
              <div>
                <label htmlFor="year-select" className="text-xs font-semibold text-[#1D2933] block mb-1.5">
                  Academic Year
                </label>
                <select
                  id="year-select"
                  value={selectedYear}
                  onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 text-sm bg-[#F6F4EF] border border-[#DDE3DC] rounded-lg text-[#1D2933] focus:border-[#164A41] focus:ring-1 focus:ring-[#164A41] focus:outline-hidden"
                >
                  <option value={1}>Year 1 (1st & 2nd Semester)</option>
                  <option value={2}>Year 2 (3rd & 4th Semester)</option>
                  <option value={3}>Year 3 (5th & 6th Semester)</option>
                  <option value={4}>Year 4 (7th & 8th Semester)</option>
                </select>
              </div>

              {/* Semester */}
              <div>
                <label htmlFor="semester-select" className="text-xs font-semibold text-[#1D2933] block mb-1.5">
                  Semester
                </label>
                <select
                  id="semester-select"
                  value={selectedSemester}
                  onChange={(e) => handleSemesterChange(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 text-sm bg-[#F6F4EF] border border-[#DDE3DC] rounded-lg text-[#1D2933] focus:border-[#164A41] focus:ring-1 focus:ring-[#164A41] focus:outline-hidden"
                >
                  {availableSemesters.map((sem) => (
                    <option key={sem} value={sem}>
                      {getSemesterLabel(sem)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Course & Category */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[#566775] block">
              2. Target Course & Category
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Course Selector */}
              <div>
                <label htmlFor="course-select" className="text-xs font-semibold text-[#1D2933] block mb-1.5">
                  Course *
                </label>
                <select
                  id="course-select"
                  required
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full px-3 py-2 text-sm bg-[#F6F4EF] border border-[#DDE3DC] rounded-lg text-[#1D2933] focus:border-[#164A41] focus:ring-1 focus:ring-[#164A41] focus:outline-hidden"
                >
                  {semesterCourses.length === 0 && (
                    <option value="">No courses available</option>
                  )}
                  {semesterCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name} ({c.credits} cr)
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Selector */}
              <div>
                <label htmlFor="category-select" className="text-xs font-semibold text-[#1D2933] block mb-1.5">
                  Resource Category *
                </label>
                <select
                  id="category-select"
                  required
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full px-3 py-2 text-sm bg-[#F6F4EF] border border-[#DDE3DC] rounded-lg text-[#1D2933] focus:border-[#164A41] focus:ring-1 focus:ring-[#164A41] focus:outline-hidden"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Document Metadata: Title & Description */}
          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-wider text-[#566775] block">
              3. Resource Details
            </label>

            <div>
              <label htmlFor="title-input" className="text-xs font-semibold text-[#1D2933] block mb-1.5">
                Resource Title *
              </label>
              <input
                id="title-input"
                type="text"
                required
                minLength={3}
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Chapter 4: Relational Algebra & Calculus Notes"
                className="w-full px-3.5 py-2.5 text-sm bg-[#F6F4EF] border border-[#DDE3DC] rounded-lg text-[#1D2933] placeholder:text-[#566775] focus:border-[#164A41] focus:ring-1 focus:ring-[#164A41] focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="desc-input" className="text-xs font-semibold text-[#1D2933] block mb-1.5">
                Description / Topics Covered (Optional)
              </label>
              <textarea
                id="desc-input"
                rows={3}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe the contents, topics covered, or specific lecture dates..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#F6F4EF] border border-[#DDE3DC] rounded-lg text-[#1D2933] placeholder:text-[#566775] focus:border-[#164A41] focus:ring-1 focus:ring-[#164A41] focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="contributor-input" className="text-xs font-semibold text-[#1D2933] block mb-1.5">
                Contributor Name or Alias (Optional)
              </label>
              <input
                id="contributor-input"
                type="text"
                maxLength={100}
                value={contributorName}
                onChange={(e) => setContributorName(e.target.value)}
                placeholder="e.g. A. Rahman or leave blank for Anonymous"
                className="w-full px-3.5 py-2.5 text-sm bg-[#F6F4EF] border border-[#DDE3DC] rounded-lg text-[#1D2933] placeholder:text-[#566775] focus:border-[#164A41] focus:ring-1 focus:ring-[#164A41] focus:outline-hidden"
              />
            </div>
          </div>

          {/* File Upload Area */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#566775] block">
              4. Upload Document (PDF only, max 10MB) *
            </label>

            {file ? (
              <div className="flex items-center justify-between p-4 bg-[#E5EEE8] border border-[#CBDAD0] rounded-xl">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 rounded-lg bg-white text-[#164A41] shadow-xs shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="truncate text-left">
                    <p className="text-xs font-bold text-[#1D2933] truncate">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-[#566775]">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB &bull; Ready for upload
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-1.5 rounded-lg text-[#566775] hover:text-[#1D2933] hover:bg-white/50 transition-colors"
                  aria-label="Remove selected file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#DDE3DC] hover:border-[#164A41] rounded-xl cursor-pointer bg-[#F6F4EF]/50 hover:bg-[#F6F4EF] transition-all group"
              >
                <Upload className="w-8 h-8 text-[#566775] group-hover:text-[#164A41] mb-2 transition-colors" />
                <span className="text-xs font-bold text-[#1D2933]">
                  Click to select PDF document
                </span>
                <span className="text-[11px] text-[#566775] mt-1">
                  Standard PDF files only &bull; Max 10 MB
                </span>
                <input
                  id="file-upload"
                  type="file"
                  required
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
            )}
          </div>

          {/* Consent Checkbox */}
          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 rounded text-[#164A41] focus:ring-[#164A41] border-[#DDE3DC]"
              />
              <span className="text-xs text-[#566775] leading-relaxed">
                I confirm that I have the right to share this study material for academic purposes, that it does not infringe copyright or institutional guidelines, and that it contains legitimate educational content.
              </span>
            </label>
          </div>

          {/* Submit Action Button */}
          <div className="pt-4 border-t border-[#DDE3DC] flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#C26B3D] hover:bg-[#A5552D] text-white font-bold text-sm shadow-xs transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting for Review...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Submit Study Material</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
