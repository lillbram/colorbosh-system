function Block({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-black/5 ${className ?? ""}`} />;
}

export function PageSkeleton() {
  return (
    <div className="flex-1">
      <div className="border-b border-border/70 bg-white px-6 py-4">
        <Block className="h-7 w-48" />
        <Block className="mt-2 h-4 w-64" />
      </div>
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Block key={i} className="h-28" />
          ))}
        </div>
        <Block className="h-72" />
        <Block className="h-56" />
      </div>
    </div>
  );
}
