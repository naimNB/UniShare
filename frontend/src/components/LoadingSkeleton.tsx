export function CardSkeleton() {
  return (
    <div className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-xs animate-pulse">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="h-5 w-20 bg-slate-200 rounded-md" />
        <div className="h-5 w-24 bg-slate-100 rounded-full" />
      </div>
      <div className="h-6 w-3/4 bg-slate-200 rounded-md mb-2" />
      <div className="h-4 w-full bg-slate-100 rounded-md mb-4" />
      <div className="h-4 w-2/3 bg-slate-100 rounded-md mb-4" />
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="h-4 w-24 bg-slate-100 rounded-md" />
        <div className="h-8 w-20 bg-slate-200 rounded-lg" />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs animate-pulse flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <div className="h-4 w-16 bg-slate-200 rounded-md" />
              <div className="h-4 w-20 bg-slate-100 rounded-full" />
            </div>
            <div className="h-5 w-3/5 bg-slate-200 rounded-md" />
            <div className="h-3.5 w-4/5 bg-slate-100 rounded-md" />
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <div className="h-8 w-20 bg-slate-200 rounded-lg" />
            <div className="h-8 w-20 bg-slate-200 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
