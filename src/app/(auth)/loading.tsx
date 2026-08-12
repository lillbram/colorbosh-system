export default function AuthLoading() {
  return (
    <div className="w-full max-w-sm animate-pulse rounded-card border border-border/70 bg-white p-6">
      <div className="mb-4 size-10 rounded-full bg-black/5" />
      <div className="h-5 w-40 rounded bg-black/5" />
      <div className="mt-2 h-4 w-56 rounded bg-black/5" />
      <div className="mt-6 space-y-3">
        <div className="h-10 rounded-lg bg-black/5" />
        <div className="h-10 rounded-lg bg-black/5" />
        <div className="h-10 rounded-lg bg-black/5" />
      </div>
    </div>
  );
}
