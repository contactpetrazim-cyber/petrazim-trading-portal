import { Lock } from 'lucide-react';

/**
 * LearningPathCard — matches the proven pattern at
 * 10m.training.petrazim.online (stage progress bar, XP, streak,
 * locked-sequence module cards) rebuilt in the corporate palette and
 * adapted from "10 pillars" to "5 bot mastery tracks + basics +
 * psychology". Sits in the Learn area.
 */

interface TrackSummary {
  id: string;
  emoji: string;
  title: string;
  description: string;
  stagesCompleted: number;
  totalStages: number;
  locked: boolean;
  route: string;
}

export function LearningStatsBar({
  totalXp, level, streakDays, overallPct,
}: { totalXp: number; level: number; streakDays: number; overallPct: number }) {
  const stats = [
    { label: 'Overall mastery', value: `${overallPct}%` },
    { label: 'Experience', value: `${totalXp} XP` },
    { label: 'Level', value: `Level ${level}` },
    { label: 'Learning streak', value: `${streakDays} day${streakDays === 1 ? '' : 's'}` },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-white rounded-xl p-4 border border-corporate-bg">
          <div className="text-2xl font-bold text-corporate-hero">{s.value}</div>
          <div className="text-xs text-gray-500 mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

export function TrackCard({ track }: { track: TrackSummary }) {
  const pct = track.totalStages > 0 ? Math.round((track.stagesCompleted / track.totalStages) * 100) : 0;

  return (
    <div className={`bg-white rounded-xl border border-corporate-bg p-5 transition-shadow ${track.locked ? 'opacity-60' : 'hover:shadow-lg'}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{track.emoji}</span>
        {track.locked && <Lock size={16} className="text-gray-400 mt-1" />}
      </div>

      <h3 className="font-bold text-corporate-text-on-bg">{track.title}</h3>
      <p className="text-sm text-gray-500 mt-1 mb-4">{track.description}</p>

      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{track.stagesCompleted}/{track.totalStages} stages</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-corporate-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-corporate-accent rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <a
        href={track.locked ? undefined : track.route}
        className={`block text-center mt-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          track.locked
            ? 'bg-corporate-bg text-gray-400 cursor-not-allowed'
            : 'bg-corporate-hero text-white hover:bg-corporate-hero-light'
        }`}
      >
        {track.locked ? 'Locked' : track.stagesCompleted > 0 ? 'Continue' : 'Begin track'}
      </a>
    </div>
  );
}
