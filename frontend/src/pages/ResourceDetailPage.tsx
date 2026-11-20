import { useState, useCallback } from 'react';
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
import { useAsyncData } from '../hooks/useAsyncData';
import { parsePositiveId } from '../utils/queryParams';
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
  const resourceId = parsePositiveId(id);
  const loadRequest = useCallback(
    (signal: AbortSignal) => api.getResource(resourceId!, signal),
    [resourceId]
  );
  const {
    data: resource,
    loading,
    error: requestError,
    reload: loadResource,
  } = useAsyncData(id || '', loadRequest, resourceId !== null);
  const error =
    resourceId === null ? 'Invalid resource ID. Use a positive whole number.' : requestError;
  const [copiedLink, setCopiedLink] = useState(false);

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
        <div className="h-4 w-48 bg-[#CBDAD0] rounded-md animate-pulse" />
        <div className="h-64 bg-white rounded-xl border border-[#DDE3DC] animate-pulse p-6" />
        <div className="h-96 bg-[#103831] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <ErrorMessage
          title="Could not load resource"
          message={error || 'The requested resource could not be found or has been moved.'}
          onRetry={loadResource}
        />
        <div className="mt-6 text-center">
          <Link
            to="/library"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#164A41] hover:text-[#103831]"
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
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-xs font-medium text-[#566775] truncate"
      >
        <Link to="/" className="hover:text-[#164A41] transition-colors shrink-0">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-[#566775] shrink-0" />
        <Link to="/library" className="hover:text-[#164A41] transition-colors shrink-0">
          Library
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-[#566775] shrink-0" />
        <span className="text-[#1D2933] font-semibold truncate">{resource.title}</span>
      </nav>

      {/* Main Metadata Card */}
      <div className="bg-white rounded-xl border border-[#DDE3DC] p-6 sm:p-8 shadow-2xs">
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
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-[#E5EEE8] text-[#164A41] hover:bg-[#CBDAD0] border border-[#CBDAD0] transition-colors"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                {resource.course.code} – {resource.course.name}
              </Link>
            )}

            {resource.course?.semester && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#F6F4EF] text-[#566775] border border-[#DDE3DC]">
                {getSemesterLabel(resource.course.semester)}
              </span>
            )}
          </div>

          {/* Share button */}
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#566775] hover:text-[#1D2933] bg-[#F6F4EF] hover:bg-[#E5EEE8] border border-[#DDE3DC] rounded-lg transition-colors"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#164A41]" />
                <span className="text-[#164A41]">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-[#566775]" />
                <span>Share</span>
              </>
            )}
          </button>
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1D2933] tracking-tight mb-4">
          {resource.title}
        </h1>

        {resource.description && (
          <p className="text-sm sm:text-base text-[#566775] leading-relaxed max-w-4xl mb-8">
            {resource.description}
          </p>
        )}

        {/* Detailed Attribute Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 sm:p-5 bg-[#F6F4EF] rounded-xl border border-[#DDE3DC] text-xs text-[#566775] mb-8">
          <div>
            <span className="block text-[11px] font-semibold text-[#566775] uppercase tracking-wider mb-1">
              File Name
            </span>
            <span className="font-semibold text-[#1D2933] break-all">
              {resource.original_filename}
            </span>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-[#566775] uppercase tracking-wider mb-1">
              File Size
            </span>
            <span className="font-semibold text-[#1D2933]">
              {formatFileSize(resource.file_size)}
            </span>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-[#566775] uppercase tracking-wider mb-1">
              Cataloged Date
            </span>
            <span className="font-semibold text-[#1D2933]">
              {formatDate(resource.created_at)}
            </span>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-[#566775] uppercase tracking-wider mb-1">
              Download Count
            </span>
            <span className="font-semibold text-[#1D2933] inline-flex items-center gap-1">
              <Download className="w-3.5 h-3.5 text-[#164A41]" />
              {resource.download_count} {resource.download_count === 1 ? 'time' : 'times'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-4">
          <a
            href={downloadUrl}
            download={resource.original_filename}
            className="px-6 py-3 bg-[#164A41] hover:bg-[#103831] text-white font-bold text-sm rounded-lg shadow-2xs hover:shadow-xs transition-all inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Resource Document
          </a>

          <a
            href="#document-preview"
            className="px-5 py-3 bg-[#F6F4EF] hover:bg-[#E5EEE8] text-[#1D2933] font-semibold text-sm rounded-lg border border-[#DDE3DC] transition-colors inline-flex items-center gap-2"
          >
            <Eye className="w-4 h-4 text-[#566775]" />
            View PDF Below
          </a>
        </div>
      </div>

      {/* PDF Document Preview Section */}
      <section id="document-preview" className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1D2933] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#164A41]" />
              Inline Document Preview
            </h2>
            <p className="text-xs text-[#566775] mt-1">
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
      <div className="pt-4 border-t border-[#DDE3DC] flex items-center justify-between">
        <Link
          to="/library"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#164A41] hover:text-[#103831]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Resource Library
        </Link>

        {resource.course && (
          <Link
            to={`/courses/${resource.course.id}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#566775] hover:text-[#1D2933]"
          >
            More materials for {resource.course.code}
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
