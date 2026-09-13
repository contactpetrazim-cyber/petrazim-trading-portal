
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import './index.css';

// Recovers from "This page could not open" showing up "every time we
// are changing sections", by direct bug report. Root cause: every
// page here is its own Vite chunk (see App.tsx's `lazy(() => import(
// './pages/...'))` calls, one per route), content-hashed by build —
// e.g. RiskPage-abc123.js. A tab left open across a deploy is still
// running the OLD build's JS, which still calls import() for the OLD
// hashed filename; that file no longer exists once a NEW deploy has
// replaced dist/ with fresh hashes, the fetch 404s, and React's lazy()
// throws straight into AppErrorBoundary — a routine, if the tab was
// open when this app got redeployed, especially with this repo
// shipping several deploys a day. `vite:preloadError` is the specific
// event Vite's own generated import wrapper fires for exactly this
// failure (not for a genuine in-app bug, which throws a different
// error entirely) — one silent reload fetches the CURRENT build's
// fresh index.html + chunk hashes and the section just opens
// correctly, instead of a trader having to notice and click "Reload
// page" themselves. Session-guarded so a chunk that's ACTUALLY
// missing (a real deploy/CDN problem, not staleness) reloads once and
// then falls through to the normal error screen rather than looping.
const CHUNK_RELOAD_FLAG = 'petrazim-chunk-reload';
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem(CHUNK_RELOAD_FLAG)) return;
  sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
  window.location.reload();
});
window.addEventListener('load', () => sessionStorage.removeItem(CHUNK_RELOAD_FLAG));

const root = document.getElementById('root');

if (!root) {
  throw new Error('Application root is missing.');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);

// Offline app shell (Settings -> Backup and Offline), by direct
// request. Registered only in production builds — a service worker
// caching Vite's own dev-server module URLs would fight hot reload
// during local development, not help it.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support degrades silently — the rest of the app works
      // identically either way, this is a pure enhancement.
    });
  });
}
