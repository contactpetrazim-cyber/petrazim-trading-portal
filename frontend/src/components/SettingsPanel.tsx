import { Link } from 'react-router-dom';
import {
  X, CreditCard, GraduationCap, CalendarClock, LayoutGrid,
  HardDriveDownload, Link2, ChevronRight, Sun, Moon,
} from 'lucide-react';
import { HERO_GRADIENT } from '../config/theme';
import type { ThemeName } from '../hooks/useTheme';

/**
 * SettingsPanel — slide-over from the gear icon in TopNav, per
 * petrazim_preview_v13_FINAL.jsx. The six items match the reference
 * exactly; only "Facilitator Sessions" links anywhere real (/meetings
 * already exists) — the rest are informational entries in the
 * reference itself (no onClick beyond the panel opening), so this
 * doesn't invent navigation the design didn't specify. Theme toggle is
 * the one functionally real control, wired to useTheme.
 */
export function SettingsPanel({
  open,
  onClose,
  theme,
  setTheme,
  dark,
}: {
  open: boolean;
  onClose: () => void;
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  dark: boolean;
}) {
  if (!open) return null;

  const items: { icon: typeof CreditCard; label: string; detail: string; to?: string }[] = [
    { icon: CreditCard, label: 'Select Access and Pay', detail: 'Choose a tier or duration pass' },
    { icon: GraduationCap, label: 'Ask Trading Coach', detail: 'Open Trade AI' },
    { icon: CalendarClock, label: 'Facilitator Sessions', detail: 'Book time with a Manager or Partner (Tier 2/3)', to: '/meetings' },
    { icon: LayoutGrid, label: 'Switch Portal', detail: 'Trader / Fund Manager / Partner / Admin — jump to a console you have access to' },
    { icon: HardDriveDownload, label: 'Backup and Offline', detail: 'Manage local data and sync' },
    { icon: Link2, label: 'Quick Links', detail: 'Shortcuts to frequent pages' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div
        className={`w-full max-w-sm h-full shadow-2xl overflow-y-auto ${dark ? 'bg-corporate-nav-dark' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between p-5 border-b ${dark ? 'border-corporate-border-dark' : 'border-corporate-bg'}`}>
          <span className={`font-bold font-display ${dark ? 'text-white' : 'text-[#141a33]'}`}>Settings</span>
          <button onClick={onClose} aria-label="Close settings">
            <X size={20} className={dark ? 'text-white/50' : 'text-[#9aa0b8]'} />
          </button>
        </div>

        {/* Theme toggle — functionally real */}
        <div className={`p-5 border-b ${dark ? 'border-corporate-border-dark' : 'border-corporate-bg'}`}>
          <div className={`text-xs font-semibold mb-3 ${dark ? 'text-white/40' : 'text-[#9aa0b8]'}`}>APPEARANCE</div>
          <div className={`flex rounded-xl p-1 ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
            <button
              onClick={() => setTheme('light')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={theme === 'light' ? { background: '#fff', color: '#005FB8', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: dark ? 'rgba(255,255,255,0.5)' : '#7c839c' }}
            >
              <Sun size={15} /> Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={theme === 'dark' ? { background: HERO_GRADIENT, color: '#fff' } : { color: dark ? 'rgba(255,255,255,0.5)' : '#7c839c' }}
            >
              <Moon size={15} /> Dark
            </button>
          </div>
        </div>

        <div className="p-3">
          {items.map((it, i) => {
            const Icon = it.icon;
            const content = (
              <>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-corporate-hero/10 text-corporate-hero">
                  <Icon size={16} />
                </span>
                <div className="flex-1 text-left">
                  <div className={`text-sm font-medium ${dark ? 'text-white' : 'text-[#141a33]'}`}>{it.label}</div>
                  <div className={`text-xs ${dark ? 'text-white/40' : 'text-[#7c839c]'}`}>{it.detail}</div>
                </div>
                <ChevronRight size={16} className={dark ? 'text-white/20' : 'text-[#c8cce0]'} />
              </>
            );
            const className = `w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${dark ? 'hover:bg-white/5' : 'hover:bg-corporate-bg'}`;
            return it.to ? (
              <Link key={i} to={it.to} onClick={onClose} className={className}>{content}</Link>
            ) : (
              <button key={i} className={className}>{content}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
