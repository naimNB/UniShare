import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (newOffset: number) => void;
  className?: string;
}

export function Pagination({
  total,
  limit,
  offset,
  onPageChange,
  className = '',
}: PaginationProps) {
  if (total <= limit) return null;

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const startItem = total === 0 ? 0 : offset + 1;
  const endItem = Math.min(offset + limit, total);

  const canGoPrev = offset > 0;
  const canGoNext = offset + limit < total;

  return (
    <nav
      aria-label="Pagination Navigation"
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 ${className}`}
    >
      <div className="text-xs sm:text-sm text-[#566775]">
        Showing <span className="font-semibold text-[#1D2933]">{startItem}</span> to{' '}
        <span className="font-semibold text-[#1D2933]">{endItem}</span> of{' '}
        <span className="font-semibold text-[#1D2933]">{total}</span> resources
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border transition-colors ${
            canGoPrev
              ? 'bg-white border-[#DDE3DC] text-[#1D2933] hover:bg-[#E5EEE8] hover:text-[#164A41] shadow-2xs'
              : 'bg-[#F6F4EF] border-[#DDE3DC] text-[#566775]/50 cursor-not-allowed'
          }`}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <span className="text-xs font-semibold px-2.5 py-1 bg-[#E5EEE8] text-[#164A41] border border-[#CBDAD0] rounded-md">
          {currentPage} / {totalPages}
        </span>

        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => onPageChange(offset + limit)}
          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border transition-colors ${
            canGoNext
              ? 'bg-white border-[#DDE3DC] text-[#1D2933] hover:bg-[#E5EEE8] hover:text-[#164A41] shadow-2xs'
              : 'bg-[#F6F4EF] border-[#DDE3DC] text-[#566775]/50 cursor-not-allowed'
          }`}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
