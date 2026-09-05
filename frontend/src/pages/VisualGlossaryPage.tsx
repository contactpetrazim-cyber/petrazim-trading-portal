import { PageHeader } from '../components/PageHeader';
import { SMCDiagram, SMC_DIAGRAM_KEYS } from '../components/SMCDiagram';
import { useThemeStore } from '../hooks/useTheme';

/**
 * VisualGlossaryPage — every SMCDiagram in one place. Linked from
 * Learn/Mastery Overview; also surfaced inline on individual lessons
 * (see LessonPage's own keyword-matched diagram section) so a
 * trainee reaches these two ways — browsing the glossary directly, or
 * having the relevant one appear right where the concept is taught.
 */
export function VisualGlossaryPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Visual Glossary" subtitle="Annotated schematics for the core Smart Money Concepts terms used throughout Learn." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SMC_DIAGRAM_KEYS.map((key) => <SMCDiagram key={key} concept={key} dark={dark} />)}
      </div>
    </div>
  );
}
