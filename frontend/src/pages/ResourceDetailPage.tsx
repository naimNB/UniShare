import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ChevronRight,
  ArrowLeft,
  Download,
  FileText,
  GraduationCap,
  Layers,
  Eye,
  Share2,
  Check,
} from 'lucide-react';
import { api } from '../api/client';
import type { Resource } from '../types/api';
import { ErrorMessage } from '../components/ErrorMessage';
import { PdfViewer } from '../components/PdfViewer';
import {
  formatDate,
  formatFileSize,
  getCategoryTheme,
  getSemesterLabel,
} from '../utils/formatters';

export function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const resourceId = id ? parseInt(id, 10) : 0;

  const loadResource = useCallback(async () => {
    if (!resourceId) {
      setError('Invalid resource ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.getResource(resourceId);
      setResource(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resource details');
    } finally {
      setLoading(false);
    }
  }, [resourceId]);

  useEffect(() => {
    loadResource();
  }, [loadResource]);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="h-4 w-48 bg-slate-200 rounded-md animate-pulse" />
        <div className="h-64 bg-white rounded-3xl border border-slate-200 animate-pulse p-6" />
        <div className="h-96 bg-slate-900 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <ErrorMessage
          title="Resource Not Found"
          message={error || 'The requested resource could not be found or has been moved.'}
          onRetry={loadResource}
        />
        <div className="mt-6 text-center">
          <Link
            to="/resources"
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Resource Library
          </Link>
        </div>
      </div>
    );
  }

  const categoryTheme = getCategoryTheme(resource.category?.name || '');
  const downloadUrl = api.getDownloadUrl(resource.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-10">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-slate-500 truncate">
        <Link to="/" className="hover:text-indigo-600 transition-colors shrink-0">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <Link to="/resources" className="hover:text-indigo-600 transition-colors shrink-0">
          Resources
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-slate-900 font-semibold truncate">{resource.title}</span>
      </nav>

      {/* Main Metadata Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${categoryTheme.badge}`}
            >
              <Layers className="w-3.5 h-3.5" />
              {resource.category?.name || 'Academic Material'}
            </span>

            {resource.course && (
              <Link
                to={`/courses/${resource.course.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                {resource.course.code} – {resource.course.name}
              </Link>
            )}

            {resource.course?.semester && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                {getSemesterLabel(resource.course.semester)}
              </span>
            )}
          </div>

          {/* Share button */}
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Share</span>
              </>
            )}
          </button>
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
          {resource.title}
        </h1>

        {resource.description && (
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-4xl mb-8">
            {resource.description}
          </p>
        )}

        {/* Detailed Attribute Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 sm:p-5 bg-slate-50/70 rounded-2xl border border-slate-100 text-xs text-slate-600 mb-8">
          <div>
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              File Name
            </span>
            <span className="font-semibold text-slate-800 break-all">
              {resource.original_filename}
            </span>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              File Size
            </span>
            <span className="font-semibold text-slate-800">
              {formatFileSize(resource.file_size)}
            </span>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Cataloged Date
            </span>
            <span className="font-semibold text-slate-800">
              {formatDate(resource.created_at)}
            </span>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Download Count
            </span>
            <span className="font-semibold text-slate-800 inline-flex items-center gap-1">
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              {resource.download_count} {resource.download_count === 1 ? 'time' : 'times'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-4">
          <a
            href={downloadUrl}
            download={resource.original_filename}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-xs hover:shadow-md transition-all inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Resource Document
          </a>

          <a
            href="#document-preview"
            className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <Eye className="w-4 h-4 text-slate-500" />
            View PDF Below
          </a>
        </div>
      </div>

      {/* PDF Document Preview Section */}
      <section id="document-preview" className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Inline Document Preview
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Rendered via UniShare direct secure document stream.
            </p>
          </div>
        </div>

        {/* The PDF Viewer component */}
        <PdfViewer
          resourceId={resource.id}
          title={resource.title}
          filename={resource.original_filename}
          mimeType={resource.mime_type}
        />
      </section>

      {/* Back button */}
      <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
        <Link
          to="/resources"
          className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Resource Library
        </Link>

        {resource.course && (
          <Link
            to={`/courses/${resource.course.id}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            More materials for {resource.course.code}
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
