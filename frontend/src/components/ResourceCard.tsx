import { Link } from 'react-router-dom';
import {
  FileText,
  Download,
  Eye,
  Calendar,
  HardDrive,
  GraduationCap,
} from 'lucide-react';
import type { Resource } from '../types/api';
import {
  formatDate,
  formatFileSize,
  getCategoryTheme,
  getSemesterOrdinal,
} from '../utils/formatters';
import { api } from '../api/client';

interface ResourceCardProps {
  resource: Resource;
  compact?: boolean;
}

export function ResourceCard({ resource, compact = false }: ResourceCardProps) {
  const categoryTheme = getCategoryTheme(resource.category?.name || '');
  const downloadUrl = api.getDownloadUrl(resource.id);

  return (
    <div className="group bg-white rounded-xl border border-[#DDE3DC] hover:border-[#CBDAD0] shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between overflow-hidden">
      <div className="p-5 sm:p-6 flex-1">
        {/* Category & Course tags */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${categoryTheme.badge}`}
            >
              {resource.category?.name || 'Academic Material'}
            </span>
            {resource.course && (
              <Link
                to={`/courses/${resource.course.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#164A41] bg-[#E5EEE8] hover:bg-[#CBDAD0] border border-[#CBDAD0] px-2 py-0.5 rounded-md transition-colors"
                title={`View ${resource.course.name}`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-[#164A41]" />
                {resource.course.code}
              </Link>
            )}
          </div>

          {resource.course?.semester && (
            <span className="text-[11px] font-medium text-[#566775]">
              {getSemesterOrdinal(resource.course.semester)} Sem
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base sm:text-lg font-bold text-[#1D2933] group-hover:text-[#164A41] transition-colors leading-snug mb-2">
          <Link to={`/resources/${resource.id}`}>{resource.title}</Link>
        </h3>

        {/* Description */}
        {!compact && resource.description && (
          <p className="text-xs sm:text-sm text-[#566775] line-clamp-2 leading-relaxed mb-4">
            {resource.description}
          </p>
        )}

        {/* Metadata info */}
        <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-[11px] text-[#566775] mt-3 pt-3 border-t border-[#DDE3DC]">
          <span className="inline-flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-[#566775]" />
            {resource.original_filename}
          </span>
          <span className="inline-flex items-center gap-1">
            <HardDrive className="w-3.5 h-3.5 text-[#566775]" />
            {formatFileSize(resource.file_size)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-[#566775]" />
            {formatDate(resource.created_at)}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-[#1D2933] ml-auto">
            <Download className="w-3.5 h-3.5 text-[#164A41]" />
            {resource.download_count} {resource.download_count === 1 ? 'download' : 'downloads'}
          </span>
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="px-5 sm:px-6 py-3 bg-[#F6F4EF] border-t border-[#DDE3DC] flex items-center justify-between gap-3">
        <Link
          to={`/resources/${resource.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D2933] hover:text-[#164A41] transition-colors py-1 px-2 rounded-md hover:bg-white"
        >
          <Eye className="w-4 h-4 text-[#566775] group-hover:text-[#164A41]" />
          Preview Details
        </Link>

        <a
          href={downloadUrl}
          download={resource.original_filename}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#164A41] hover:bg-[#103831] text-white rounded-lg shadow-2xs hover:shadow-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#164A41]"
          aria-label={`Download ${resource.title}`}
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </a>
      </div>
    </div>
  );
}
