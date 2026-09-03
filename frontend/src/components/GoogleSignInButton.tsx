import { useEffect, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

let gsiScriptPromise: Promise<void> | null = null;

/** Loads Google Identity Services' script exactly once, however many
 * GoogleSignInButton instances end up mounted (e.g. login re-renders,
 * or a future registration page reusing this same component). */
function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiScriptPromise) {
    gsiScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });
  }
  return gsiScriptPromise;
}

/**
 * GoogleSignInButton — renders Google's own "Continue with Google"
 * button via Google Identity Services (the button-flow: a signed ID
 * token comes back client-side with no page redirect and no client
 * secret involved), then POSTs that token to the real
 * POST /auth/google for server-side verification.
 *
 * First asks GET /auth/google/client-id whether the backend actually
 * has a Client ID configured — renders nothing at all when it
 * doesn't, rather than showing a button that would 503 on click. This
 * is what makes the button safe to ship now: it stays invisible until
 * a real Google Cloud OAuth Client ID is set as a Render env var, no
 * code change needed at that point.
 */
export function GoogleSignInButton({
  onSuccess,
  onError,
}: {
  onSuccess: (data: { access_token: string; user: any }) => void;
  onError: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/auth/google/client-id`)
      .then((r) => (r.ok ? r.json() : { client_id: null }))
      .then((data) => setClientId(data.client_id))
      .catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (!clientId || !containerRef.current) return;
    let cancelled = false;

    loadGsiScript()
      .then(() => {
        if (cancelled || !window.google || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (resp) => {
            try {
              const res = await fetch(`${API_URL}/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: resp.credential }),
              });
              const body = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(body.detail || 'Google sign-in failed');
              onSuccess(body);
            } catch (err: any) {
              onError(err.message || 'Google sign-in failed');
            }
          },
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        });
      })
      .catch(() => onError('Could not load Google sign-in'));

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) return null;

  return <div ref={containerRef} className="w-full flex justify-center mb-3" />;
}
