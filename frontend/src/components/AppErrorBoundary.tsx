import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, LogIn, RefreshCw } from 'lucide-react';

interface Props { children: ReactNode }
interface State { error: Error | null; reloading: boolean }

// Originally only matched a specific list of known "stale chunk"
// browser error phrasings (see main.tsx's own `vite:preloadError`
// listener for the full mechanism) — by direct bug report, the exact
// same "This page could not open" screen recurred even after that
// fix shipped, meaning whatever actually threw that time used
// phrasing this regex didn't cover (browsers keep inventing new
// wording for this, and it's not the only way a stale deploy can
// surface — a rejected `.then()` inside a route's own `lazy(() =>
// import(...).then(...))` call, used by every route here to pick a
// named export, can throw all sorts of messages depending on exactly
// what failed to load). Now ANY uncaught render error gets exactly
// ONE silent reload attempt, not just ones matching a known pattern —
// broader, but still safe: a genuine code bug (not a stale deploy)
// just gets one extra harmless reload before showing the real error
// screen on its second occurrence, since the flag then stays set.
const CHUNK_RELOAD_FLAG = 'petrazim-chunk-reload';

/** Keeps an unexpected page failure from becoming a blank screen. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reloading: false };

  static getDerivedStateFromError(error: Error): State {
    // React's own error-boundary lifecycle runs
    // getDerivedStateFromError -> render -> componentDidCatch, in that
    // order — reading sessionStorage HERE, before componentDidCatch
    // has a chance to write to it, is what makes `reloading` correct
    // on the very FIRST render after an error, not just the second
    // one. By direct bug report ("still showing this for a very brief
    // moment - fix permanently"): the previous version decided what to
    // render by re-reading sessionStorage inside render() itself, but
    // componentDidCatch (which sets the flag) hadn't run yet on that
    // first pass — so the full "This page could not open" screen
    // painted for one frame before componentDidCatch's own
    // window.location.reload() actually took effect, exactly the
    // "brief flash" being reported. Computing `reloading` once, here,
    // and reusing that same decision in both componentDidCatch and
    // render eliminates the race instead of narrowing its window.
    return { error, reloading: !sessionStorage.getItem(CHUNK_RELOAD_FLAG) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Petrazim page error', error, info.componentStack);
    if (this.state.reloading) {
      sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
      window.location.reload();
    }
  }

  private retry = () => window.location.reload();
  private signIn = () => window.location.assign('/login');

  render() {
    if (!this.state.error) return this.props.children;

    // A reload is already in flight (getDerivedStateFromError decided
    // this the instant the error was caught, before this first paint)
    // — show a plain, non-alarming "hang on" instead of the full
    // "This page could not open" screen for the brief moment before
    // window.location.reload() actually navigates away. If the reload
    // itself somehow doesn't happen, or a SECOND error occurs after a
    // reload already ran once this session, `reloading` is false and
    // this falls through to the real error screen below — never stuck
    // silently on this forever, and a genuine bug still surfaces.
    if (this.state.reloading) {
      return (
        <main className="min-h-screen bg-corporate-bg flex items-center justify-center">
          <p className="text-sm text-gray-500">Updating to the latest version…</p>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-corporate-bg px-5 py-12 text-corporate-text-on-bg flex items-center justify-center">
        <section className="w-full max-w-md rounded-2xl border border-corporate-hero/20 bg-white p-6 shadow-xl text-center" role="alert">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-smc-danger/10 text-smc-danger">
            <AlertTriangle size={24} aria-hidden="true" />
          </span>
          <h1 className="font-display text-2xl font-bold">This page could not open</h1>
          <p className="mt-2 text-sm text-gray-600">Your account data is safe. Reload the page, or return to sign in.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={this.retry} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-corporate-hero px-4 py-3 font-semibold text-corporate-text-on-hero">
              <RefreshCw size={17} /> Reload page
            </button>
            <button type="button" onClick={this.signIn} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-corporate-hero/20 bg-white px-4 py-3 font-semibold text-corporate-hero">
              <LogIn size={17} /> Sign in
            </button>
          </div>
        </section>
      </main>
    );
  }
}
