import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, LogIn, RefreshCw } from 'lucide-react';

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Keeps an unexpected page failure from becoming a blank screen. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Petrazim page error', error, info.componentStack);
  }

  private retry = () => window.location.reload();
  private signIn = () => window.location.assign('/login');

  render() {
    if (!this.state.error) return this.props.children;

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
