import { Loader2 } from 'lucide-react';

export function RouteLoadingFallback() {
  return (
    <main className="min-h-screen bg-corporate-bg px-5 py-12 text-corporate-text-on-bg flex items-center justify-center" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3 text-sm font-semibold">
        <Loader2 className="animate-spin text-corporate-hero" size={20} aria-hidden="true" />
        Opening your page…
      </div>
    </main>
  );
}
