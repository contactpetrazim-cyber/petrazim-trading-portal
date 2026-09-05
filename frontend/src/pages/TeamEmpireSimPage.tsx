import { PageHeader } from '../components/PageHeader';
import { EmpireSimEngine } from '../components/EmpireSimEngine';
import { PROP_FIRM_EMPIRE_CONFIG } from '../config/propFirmEmpireConfig';
import { useThemeStore } from '../hooks/useTheme';

/**
 * TeamEmpireSimPage — Section 10b's Team Empire Simulation, first real
 * config (Prop Firm Growth Challenge). Not scored/persisted like the
 * solo games — this is a same-screen group activity, not an
 * individual XP-earning drill, matching the spec's own framing of it
 * as a distinct feature from Section 10a's solo games.
 */
export function TeamEmpireSimPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Team Empire Simulation" subtitle="4-5 teams, same-screen pass-and-play. Weekly risk decisions, weighted outcomes, a comparative debrief." />
      <EmpireSimEngine config={PROP_FIRM_EMPIRE_CONFIG} backHref="/practise/game" dark={dark} />
    </div>
  );
}
