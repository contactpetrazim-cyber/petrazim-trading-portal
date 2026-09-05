import { useEffect, useState, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Dumbbell } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ListenButton } from '../components/ListenButton';
import { RecapPanel } from '../components/RecapPanel';
import { RetrievalQuizWidget } from '../components/RetrievalQuizWidget';
import { FlashcardWidget } from '../components/FlashcardWidget';
import { BookmarkButton } from '../components/BookmarkButton';
import { NotebookWidget } from '../components/NotebookWidget';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../components/AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface LessonDetail {
  id: string;
  track_id: string;
  track_title: string;
  stage_id: string;
  stage_number: number;
  stage_title: string;
  title: string;
  content_body: string;
  estimated_minutes: number;
}

type Block =
  | { type: 'h'; level: number; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'table'; rows: string[][] }
  | { type: 'hr' };

/**
 * A deliberately minimal markdown subset — not a general-purpose
 * parser. Every authored lesson (parse_authored_lessons in
 * seed_curriculum.py) only ever uses '## '/'### ' headers, '- '/'N. '
 * lists, '---' rules, '**bold**'/'`code`'/'*italic*' inline spans, and
 * (BOOK_KNOWLEDGE.md only) '|'-delimited tables — verified against
 * every curriculum/*.md file rather than assumed. No fenced code
 * blocks or links appear anywhere in the authored content, so neither
 * is handled here. Pulling in a full markdown library for this one
 * fixed subset would be the wrong trade.
 */
function parseLessonBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'p', text: paragraph.join(' ') });
      paragraph = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed === '') { flushParagraph(); i++; continue; }

    const headerMatch = trimmed.match(/^(#{2,4})\s+(.*)$/);
    if (headerMatch) {
      flushParagraph();
      blocks.push({ type: 'h', level: headerMatch[1].length, text: headerMatch[2].trim() });
      i++; continue;
    }

    if (trimmed === '---') { flushParagraph(); blocks.push({ type: 'hr' }); i++; continue; }

    if (/^-\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      const ordered = /^\d+\.\s+/.test(trimmed);
      const marker = ordered ? /^\d+\.\s+/ : /^-\s+/;
      const items: string[] = [];
      // Every authored list item wraps across multiple indented lines
      // rather than staying on one physical line — a continuation line
      // (doesn't start a new '- '/'N. ' marker or another block type)
      // gets appended onto the item currently being built.
      while (i < lines.length) {
        const t = lines[i].trim();
        if (t === '') break;
        if (marker.test(t)) { items.push(t.replace(marker, '')); i++; continue; }
        if (/^-\s+/.test(t) || /^\d+\.\s+/.test(t) || /^#{2,4}\s+/.test(t) || t === '---' || /^\|.*\|$/.test(t)) break;
        if (items.length) items[items.length - 1] += ' ' + t;
        i++;
      }
      blocks.push(ordered ? { type: 'ol', items } : { type: 'ul', items });
      continue;
    }

    if (/^\|.*\|$/.test(trimmed)) {
      flushParagraph();
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        rows.push(lines[i].trim().slice(1, -1).split('|').map((c) => c.trim()));
        i++;
      }
      // Drop the '|---|---|' alignment row every markdown table has.
      blocks.push({ type: 'table', rows: rows.filter((r) => !r.every((c) => /^:?-+:?$/.test(c))) });
      continue;
    }

    // A line starting a fresh bold lead-in ('**Level:** 0', '**Plain-
    // English explanation.** ...') always marks a new logical line in
    // the source, whether it's one of a short run of label:value
    // lines or the start of a longer wrapped paragraph — either way
    // it should never be glued onto whatever text came before it.
    if (trimmed.startsWith('**') && paragraph.length) flushParagraph();
    paragraph.push(trimmed);
    i++;
  }
  flushParagraph();
  return blocks;
}

/** Bold, inline code, and italic — the only inline spans the authored
 * content actually uses (verified above). Order matters: '**bold**'
 * and '`code`' are tried before single-'*' italic so a bold span's
 * own asterisks never get mistaken for an italic one. */
function renderInline(text: string): ReactNode {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith('**') && tok.endsWith('**')) return <strong key={i}>{tok.slice(2, -2)}</strong>;
    if (tok.startsWith('`') && tok.endsWith('`')) {
      return <code key={i} className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[0.9em]">{tok.slice(1, -1)}</code>;
    }
    if (tok.startsWith('*') && tok.endsWith('*') && tok.length > 1) return <em key={i}>{tok.slice(1, -1)}</em>;
    return tok;
  });
}

function LessonBody({ content, dark }: { content: string; dark: boolean }) {
  const mutedCls = dark ? 'text-white/70' : 'text-gray-700';
  const headingCls = dark ? 'text-white' : 'text-corporate-text-on-bg';
  // Every content_body opens with its own '## CODE — Title' header
  // (parse_authored_lessons's own doing) — drop it here since
  // PageHeader already shows the lesson's title just above this card.
  const allBlocks = parseLessonBlocks(content);
  const blocks = allBlocks[0]?.type === 'h' && allBlocks[0].level === 2 ? allBlocks.slice(1) : allBlocks;

  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h':
            return (
              <h3
                key={i}
                className={`font-bold ${headingCls} ${b.level === 2 ? 'text-lg mt-6' : 'text-sm uppercase tracking-wide mt-5'}`}
              >
                {renderInline(b.text)}
              </h3>
            );
          case 'p':
            return <p key={i} className={`text-sm leading-relaxed ${mutedCls}`}>{renderInline(b.text)}</p>;
          case 'ul':
            return (
              <ul key={i} className={`list-disc list-outside pl-5 space-y-1 text-sm leading-relaxed ${mutedCls}`}>
                {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className={`list-decimal list-outside pl-5 space-y-1 text-sm leading-relaxed ${mutedCls}`}>
                {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
              </ol>
            );
          case 'table':
            return (
              <div key={i} className="overflow-x-auto">
                <table className="text-sm w-full border-collapse">
                  <thead>
                    <tr>
                      {b.rows[0]?.map((c, j) => (
                        <th key={j} className={`text-left font-semibold p-2 border-b ${dark ? 'border-white/10 text-white' : 'border-gray-200 text-corporate-text-on-bg'}`}>
                          {renderInline(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.slice(1).map((row, ri) => (
                      <tr key={ri}>
                        {row.map((c, ci) => (
                          <td key={ci} className={`p-2 align-top border-b ${dark ? 'border-white/5' : 'border-gray-100'} ${mutedCls}`}>
                            {renderInline(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'hr':
            return <hr key={i} className={dark ? 'border-white/10 my-4' : 'border-gray-100 my-4'} />;
        }
      })}
    </div>
  );
}

/**
 * LessonPage — the actual reading view every other Learn page was
 * missing. GET /curriculum/tracks/{id} only ever returned the stage
 * list (title, XP, lock state); the practice/quiz/game endpoints each
 * parse one small subsection of a lesson (Practice Drill, Mini Quiz).
 * Nothing ever let a learner read a lesson's full authored content
 * (Core Teaching, Worked Example, Key Takeaways, etc.) until this page
 * and its backing endpoint (GET /curriculum/lessons/{id}).
 *
 * "Practice this lesson" — connects Learn to Practice, by direct
 * request ("fix and connect learn page and practise page"). Detects a
 * "### Practice Drill" heading in this lesson's own content_body (the
 * exact section routers/practise.py's list_drills already extracts
 * server-side) rather than a second fetch just to ask "does this
 * lesson have a drill" — the full content_body is already sitting
 * right here. Links to /practise/drills?lesson={id}, which
 * PracticeDrillsPage reads to auto-expand and scroll to that lesson's
 * own drill instead of leaving you to hunt across every track's card.
 */
export function LessonPage() {
  const { trackId, lessonId } = useParams<{ trackId: string; lessonId: string }>();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !lessonId) return;
    setLesson(null);
    setError(null);
    apiFetch(`${API_URL}/curriculum/lessons/${lessonId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          throw new Error(body?.detail || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(setLesson)
      .catch((e) => setError(e.message || 'Could not load this lesson right now.'));
  }, [token, lessonId]);

  const backHref = trackId ? `/learn/tracks/${trackId}` : '/learn';

  return (
    <div>
      <Link to={backHref} className={`inline-flex items-center gap-1.5 text-sm mb-4 ${dark ? 'text-white/60' : 'text-corporate-hero'}`}>
        <ArrowLeft size={15} /> Back to track
      </Link>

      {error && (
        <div className={`text-sm rounded-xl p-3 mb-4 ${dark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-600'}`}>
          {error}
        </div>
      )}

      {!lesson && !error && (
        <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Loading lesson…</p>
      )}

      {lesson && (
        <>
          <PageHeader
            title={lesson.title}
            subtitle={`${lesson.track_title} · Stage ${lesson.stage_number}: ${lesson.stage_title} · ~${lesson.estimated_minutes} min`}
          />
          <div className="flex flex-wrap gap-2 mb-4">
            <BookmarkButton stageId={lesson.stage_id} dark={dark} />
            <NotebookWidget stageId={lesson.stage_id} dark={dark} />
          </div>
          <div className={`rounded-2xl p-6 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
            {lesson.content_body ? (
              <>
                <div className="mb-4"><ListenButton text={lesson.content_body} dark={dark} /></div>
                <LessonBody content={lesson.content_body} dark={dark} />
              </>
            ) : (
              <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Not yet authored.</p>
            )}
          </div>

          {lesson.content_body && (
            <div className="flex flex-col gap-3 mt-4">
              <RecapPanel lessonId={lesson.id} dark={dark} />
              <RetrievalQuizWidget lessonId={lesson.id} dark={dark} />
              <FlashcardWidget lessonId={lesson.id} dark={dark} />
            </div>
          )}

          {lesson.content_body?.includes('### Practice Drill') && (
            <Link
              to={`/practise/drills?lesson=${lesson.id}`}
              className={`inline-flex items-center gap-2 text-sm font-medium mt-4 px-4 py-2.5 rounded-xl transition-colors ${
                dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-corporate-bg text-corporate-hero hover:bg-corporate-hero/10'
              }`}
            >
              <Dumbbell size={16} /> Practice this lesson →
            </Link>
          )}
        </>
      )}
    </div>
  );
}
