
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import './index.css';

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
