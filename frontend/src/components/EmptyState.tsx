import type { ReactNode } from 'react';
import { SearchX, FolderOpen } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: 'search' | 'folder';
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title = 'No resources found',
  message = 'Try adjusting your search criteria, removing filters, or exploring other semesters.',
  icon = 'search',
  action,
  className = '',
}: EmptyStateProps) {
  const IconComponent = icon === 'search' ? SearchX : FolderOpen;

  return (
    <div
      className={`p-10 sm:p-14 bg-white rounded-xl border border-[#DDE3DC] text-center flex flex-col items-center justify-center ${className}`}
    >
      <div className="w-14 h-14 rounded-xl bg-[#E5EEE8] flex items-center justify-center text-[#164A41] mb-4">
        <IconComponent className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-bold text-[#1D2933] mb-2">{title}</h3>
      <p className="text-sm text-[#566775] max-w-md mx-auto mb-6 leading-relaxed">
        {message}
      </p>
      {action && <div className="inline-flex items-center gap-3">{action}</div>}
    </div>
  );
}
