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
      className={`p-10 sm:p-14 bg-white rounded-2xl border border-slate-200/80 text-center flex flex-col items-center justify-center ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
        <IconComponent className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
        {message}
      </p>
      {action && <div className="inline-flex items-center gap-3">{action}</div>}
    </div>
  );
}
