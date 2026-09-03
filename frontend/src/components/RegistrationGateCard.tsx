import { useState } from 'react';

/**
 * Recreated exactly from the Phase 2 build. Note the gap flagged in
 * OnboardingPage.tsx: this form collects name/email/phone only,
 * matching the reference screenshots — a real registration needs a
 * password field added here before go-live, since /auth/register
 * requires one and OnboardingPage currently can't supply a real one
 * on the user's behalf.
 */
export function RegistrationGateCard({
  onSubmit,
}: {
  onSubmit: (data: { name: string; email: string; phone: string }) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden max-w-md w-full">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <span className="font-medium text-corporate-text-on-bg">Register to Unlock Access</span>
        <span className="text-gray-400 text-sm">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-3">
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-corporate-text-on-bg focus:outline-none focus:border-corporate-accent"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-corporate-text-on-bg focus:outline-none focus:border-corporate-accent"
          />
          <input
            type="tel"
            placeholder="Phone (with country code)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-corporate-text-on-bg focus:outline-none focus:border-corporate-accent"
          />
          <button
            onClick={() => onSubmit({ name, email, phone })}
            disabled={!name || !email || !phone}
            className="w-full bg-corporate-accent text-white font-medium py-2.5 rounded-lg text-sm hover:opacity-90 transition disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
