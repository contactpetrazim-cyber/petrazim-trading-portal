import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Dumbbell, SkipForward, LogOut, CheckSquare, Square, Lock } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ListenButton } from '../components/ListenButton';
import { RecapPanel } from '../components/RecapPanel';
import { RetrievalQuizWidget } from '../components/RetrievalQuizWidget';
import { FlashcardWidget } from '../components/FlashcardWidget';
import { OrientDiagram } from '../components/OrientDiagram';
import { ConceptDiagram } from '../components/ConceptDiagram';
import { QuizSlide } from '../components/QuizSlide';
import { BookmarkButton } from '../components/BookmarkButton';
import { NotebookWidget } from '../components/NotebookWidget';
import { useThemeStore } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastStack';
import { AWARDS_REFRESH_EVENT } from '../components/BadgeUnlockWatcher';
import { fetchJsonWithRetry, makeIdempotencyKey, type FetchPhase } from '../lib/resilientFetch';
import { apiFetch } from '../components/AccessExpiredGate';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { parseMiniQuiz, type QuizQuestion } from '../lib/quizParser';

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

/** Just enough of GET /curriculum/tracks/{id}'s own StageResponse to
 * drive the Stage nav below — same fields LearnTrackPage.tsx's own
 * local `Stage` interface already uses, kept as its own small copy
 * here rather than a cross-file import (this file already does that
 * for VISUAL_PLACEHOLDER_RE-style small, page-local pieces). */
interface StageNavEntry {
  id: string;
  stage_number: number;
  title: string;
  lesson_id: string | null;
  completed: boolean;
  can_attempt: boolean;
}

// This authored curriculum's `[VISUAL: key — description]` bracket
// format (Honest Gap Orientation only — see OrientDiagram) and every
// other track's `See diagram: \`file.svg\` — description` sentence.
// Both previously rendered as literal text — by direct bug report
// ("turn them all to diagrams - the visuals references").
const VISUAL_PLACEHOLDER_RE = /\[VISUAL:\s*([a-z0-9-]+)\s*[—-]\s*([^\]]+)\]/i;
const SEE_DIAGRAM_RE = /See diagram:\s*`([^`]+?)\.svg`\s*[—-]\s*([\s\S]+)$/i;

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
      blocks.push({ type: 'table', rows: rows.filter((r) => !r.every((c) => /^:?-+:?$/.test(c))) });
      continue;
    }

    if (trimmed.startsWith('**') && paragraph.length) flushParagraph();
    paragraph.push(trimmed);
    i++;
  }
  flushParagraph();
  return blocks;
}

function renderInline(text: string): ReactNode {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^*]+`|\*[^*\n]+\*)/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith('**') && tok.endsWith('**')) return <strong key={i}>{tok.slice(2, -2)}</strong>;
    if (tok.startsWith('`') && tok.endsWith('`')) {
      return <code key={i} className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[0.9em]">{tok.slice(1, -1)}</code>;
    }
    if (tok.startsWith('*') && tok.endsWith('*') && tok.length > 1) return <em key={i}>{tok.slice(1, -1)}</em>;
    return tok;
  });
}

function extractRawSection(content: string, headingName: string): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const startRe = new RegExp(`^#{2,4}\\s+${headingName}\\s*$`, 'i');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (startRe.test(lines[i].trim())) { start = i + 1; break; }
  }
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (/^#{2,4}\s+\S/.test(lines[i].trim())) { end = i; break; }
  }
  return lines.slice(start, end).join('\n').trim();
}

// Groups the ~17 headed sections every authored lesson has (verified
// against every curriculum/*.md file, same discipline as every other
// fixed-template assumption in this parser) into a small number of
// real "pages" — by direct request ("learning content is just a dump
// of paragraphs ... turn into a dynamic learning training system that
// moves stage by stage or page by page"). An unrecognized heading
// (defensive, in case future content varies) falls into the last page
// rather than being silently dropped.
const PAGE_GROUPS: [string, string[]][] = [
  ['Overview', ['Why This Matters']],
  ['Core Teaching', ['Core Teaching', 'Visual Model']],
  ['Examples', ['Worked Example', 'Counterexample', 'Good Example / Bad Example']],
  ['What to Watch For', ['What to Look Out For', 'Common Mistakes', 'Key Takeaways']],
  ['Practice', ['Practice Drill', 'Scenario Challenge']],
  ['Mini Quiz', ['Mini Quiz']],
  ['Wrap-Up', ['Flashcards', 'Reflection', 'Mastery Criteria', 'Spaced Review', 'Bot Connection']],
];

interface Page { title: string; blocks: Block[] }

function buildPages(blocks: Block[]): Page[] {
  const pages: Page[] = PAGE_GROUPS.map(([title]) => ({ title, blocks: [] }));
  const headingToPage = new Map<string, number>();
  PAGE_GROUPS.forEach(([, headings], idx) => headings.forEach((h) => headingToPage.set(h.toLowerCase(), idx)));

  let current = 0; // meta lines + "Why This Matters" -> Overview
  for (const block of blocks) {
    if (block.type === 'h' && block.level === 3) {
      const idx = headingToPage.get(block.text.toLowerCase());
      current = idx !== undefined ? idx : pages.length - 1;
    }
    pages[current].blocks.push(block);
  }
  return pages.filter((p) => p.blocks.length > 0);
}

function renderParagraph(text: string, dark: boolean, key: number): ReactNode {
  const mutedCls = dark ? 'text-white/70' : 'text-gray-700';

  const visualMatch = text.match(VISUAL_PLACEHOLDER_RE);
  if (visualMatch) {
    const [full, diagramKey, description] = visualMatch;
    const before = text.slice(0, visualMatch.index).trim();
    const after = text.slice((visualMatch.index ?? 0) + full.length).trim();
    return (
      <div key={key} className="space-y-3">
        {before && <p className={`text-sm leading-relaxed ${mutedCls}`}>{renderInline(before)}</p>}
        <OrientDiagram diagramKey={diagramKey} description={description.replace(/\s+/g, ' ').trim()} dark={dark} />
        {after && <p className={`text-sm leading-relaxed ${mutedCls}`}>{renderInline(after)}</p>}
      </div>
    );
  }

  const seeMatch = text.match(SEE_DIAGRAM_RE);
  if (seeMatch) {
    const [full, filePath, description] = seeMatch;
    const before = text.slice(0, seeMatch.index).trim();
    const fileSlug = filePath.split('/').pop() || filePath;
    return (
      <div key={key} className="space-y-3">
        {before && <p className={`text-sm leading-relaxed ${mutedCls}`}>{renderInline(before)}</p>}
        <ConceptDiagram fileSlug={fileSlug} description={description.replace(/\s+/g, ' ').trim()} dark={dark} />
      </div>
    );
  }

  return <p key={key} className={`text-sm leading-relaxed ${mutedCls}`}>{renderInline(text)}</p>;
}

function PageBlocks({ blocks, dark }: { blocks: Block[]; dark: boolean }) {
  const mutedCls = dark ? 'text-white/70' : 'text-gray-700';
  const headingCls = dark ? 'text-white' : 'text-corporate-text-on-bg';
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h':
            return (
              <h3 key={i} className={`font-bold ${headingCls} ${b.level === 2 ? 'text-lg mt-6' : 'text-sm uppercase tracking-wide mt-5 first:mt-0'}`}>
                {renderInline(b.text)}
              </h3>
            );
          case 'p':
            return renderParagraph(b.text, dark, i);
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
 * LessonReader — the page-by-page, "computer-based-training" reading
 * flow, by direct request: "learning content is just a dump of
 * paragraphs ... turn into a dynamic learning training system that
 * moves stage by stage or page by page ... Put confirm understand this
 * stage to move on toggle ... Back - Next buttons ... Skip or Forced
 * End Buttons". Adapted from the reference training portal's
 * ModuleLearning/AssessmentStage pattern (a Back/Next-paginated reader
 * with a real interactive quiz and a completion gate at the end) onto
 * this app's own lesson content and its real POST /stages/complete
 * dual gate, instead of every section of a lesson stacked into one
 * long scroll.
 *
 * Back/Next move one page at a time. Skip jumps straight to the final
 * Wrap-Up page (matching common CBT "skip module" semantics — "I
 * already know this, take me to the end") rather than duplicating
 * Next's one-step behavior. End Lesson exits immediately back to the
 * track, from any page, without completing anything. The "I understand
 * this stage" toggle only appears on the final page and gates Mark
 * Stage Complete — the same POST /curriculum/stages/complete
 * LearnTrackPage's own stage list already calls, so completing from
 * either surface behaves identically (same dual-gate reason message,
 * same XP/streak/certificate toasts).
 */
function LessonReader({
  lesson, trackId, stages, dark,
}: { lesson: LessonDetail; trackId: string | undefined; stages: StageNavEntry[]; dark: boolean }) {
  const { token } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();
  const backHref = trackId ? `/learn/tracks/${trackId}` : '/learn';

  // Stage-level nav ("Stage 2 of 23", jump to the adjacent stage) — by
  // direct request ("use this for the learning LMS for the stage and
  // substage content Nav"). `stages` is the SAME locked-sequence list
  // LearnTrackPage already fetches and gates on — reused here rather
  // than duplicating that access logic, so Next Stage can only ever
  // land somewhere the trainee is actually allowed to be. A previous
  // stage is always safe to revisit (you can't be on THIS stage
  // without it already being unlocked), so Prev Stage has no lock
  // check of its own.
  const stageIndex = stages.findIndex((s) => s.id === lesson.stage_id);
  const prevStage = stageIndex > 0 ? stages[stageIndex - 1] : null;
  const nextStage = stageIndex >= 0 && stageIndex < stages.length - 1 ? stages[stageIndex + 1] : null;
  const nextStageOpen = !!nextStage && !!nextStage.lesson_id && (nextStage.can_attempt || nextStage.completed);

  const allBlocks = useMemo(() => parseLessonBlocks(lesson.content_body), [lesson.content_body]);
  const bodyBlocks = allBlocks[0]?.type === 'h' && allBlocks[0].level === 2 ? allBlocks.slice(1) : allBlocks;
  const pages = useMemo(() => buildPages(bodyBlocks), [bodyBlocks]);
  const quizQuestions: QuizQuestion[] = useMemo(() => {
    const raw = extractRawSection(lesson.content_body, 'Mini Quiz');
    return raw ? parseMiniQuiz(raw) : [];
  }, [lesson.content_body]);

  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => setPageIndex(0), [lesson.id]);

  // Per-substage "I understand" acknowledgement — by direct request
  // ("Add the toggle and 'I understand' for every substage and it is a
  // trigger to go the next page"), extending what previously only
  // gated the final Wrap-Up page's Mark Stage Complete button. Keyed
  // by page index rather than a single flag so moving Back and
  // re-Next doesn't lose an earlier page's acknowledgement, and reset
  // whenever a different lesson is opened (a fresh read-through).
  const [pageAck, setPageAck] = useState<Record<number, boolean>>({});
  useEffect(() => setPageAck({}), [lesson.id]);
  const acknowledgedCurrentPage = !!pageAck[pageIndex];

  const [understood, setUnderstood] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeResult, setCompleteResult] = useState<{ ok: boolean; message: string } | null>(null);
  // One key per lesson (regenerates whenever a different lesson is
  // opened) — pairs with the backend's Idempotency-Key guard
  // (app/core/idempotency.py) so a retry of Mark Stage Complete for
  // THIS lesson replays the original result instead of a second
  // completion attempt, without permanently caching a stale answer
  // once the trainee moves to a different lesson.
  const completeIdempotencyKey = useMemo(() => makeIdempotencyKey(), [lesson.id]);

  const page = pages[pageIndex];
  const isLastPage = pageIndex === pages.length - 1;
  const mutedCls = dark ? 'text-white/40' : 'text-gray-400';
  const navBtnCls = `inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
    dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-corporate-bg text-corporate-hero hover:bg-corporate-hero/10'
  }`;

  async function markComplete() {
    setCompleting(true);
    setCompleteResult(null);
    try {
      const res = await apiFetch(`${API_URL}/curriculum/stages/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', Authorization: `Bearer ${token}`,
          'Idempotency-Key': completeIdempotencyKey,
        },
        body: JSON.stringify({ stage_id: lesson.stage_id }),
      });
      const data = await res.json();
      if (data.completed) {
        setCompleteResult({ ok: true, message: `Stage complete — +${data.xp_awarded} XP.` });
        showToast({ icon: '✅', title: `Stage complete — +${data.xp_awarded} XP`, variant: 'info' });
        if (typeof data.new_streak_days === 'number' && data.new_streak_days > 1) {
          showToast({ icon: '🔥', title: `${data.new_streak_days}-day streak`, description: 'Keep the streak alive — come back tomorrow.', variant: 'streak' });
        }
        if (data.certificate_issued) {
          showToast({ icon: '🏆', title: 'Certificate issued!', description: `${lesson.track_title} — see it on Awards & Certificates.`, variant: 'certificate' });
        }
        window.dispatchEvent(new CustomEvent(AWARDS_REFRESH_EVENT));
      } else {
        setCompleteResult({ ok: false, message: data.reason || 'Not ready to complete yet.' });
      }
    } finally {
      setCompleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={lesson.title}
        subtitle={`${lesson.track_title} · Stage ${lesson.stage_number}: ${lesson.stage_title} · ~${lesson.estimated_minutes} min`}
      />

      {/* Stage nav — "Stage 2 of 23", jump to the adjacent stage.
          Hidden if the stage list hasn't loaded (or is a single-stage
          track) rather than showing a meaningless "Stage 1 of 1". */}
      {stages.length > 1 && stageIndex >= 0 && (
        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            onClick={() => prevStage?.lesson_id && navigate(`/learn/tracks/${trackId}/lessons/${prevStage.lesson_id}`)}
            disabled={!prevStage?.lesson_id}
            className={navBtnCls}
          >
            <ChevronLeft size={15} /> Prev Stage
          </button>
          <span className={`text-xs font-semibold shrink-0 ${mutedCls}`}>
            Stage {lesson.stage_number} of {stages.length}
          </span>
          <button
            onClick={() => nextStage?.lesson_id && navigate(`/learn/tracks/${trackId}/lessons/${nextStage.lesson_id}`)}
            disabled={!nextStageOpen}
            title={nextStage && !nextStageOpen ? 'Complete this stage to unlock the next one' : undefined}
            className={navBtnCls}
          >
            {nextStageOpen ? <>Next Stage <ChevronRight size={15} /></> : <><Lock size={13} /> Next Stage</>}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <BookmarkButton stageId={lesson.stage_id} dark={dark} />
        <NotebookWidget stageId={lesson.stage_id} dark={dark} />
        <ListenButton text={lesson.content_body} dark={dark} />
      </div>

      {/* Substage nav — a slim progress bar plus a row of clickable
          pills, one per page, so a page already read can be jumped to
          directly instead of only Back/Next. Pills are never lock-
          gated: "Skip" below already lets a trainee bypass every
          acknowledgement straight to the end, so gating the pills too
          would just be a second, inconsistent way to express the same
          rule — the "I understand" checkbox is a reading nudge, not
          hard enforcement (stage completion server-side is the real
          gate — see markComplete below). */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-xs font-semibold ${dark ? 'text-white/70' : 'text-corporate-text-on-bg'}`}>
            Page {pageIndex + 1} of {pages.length} · {page.title}
          </span>
          <span className={`text-xs ${mutedCls}`}>{Math.round(((pageIndex + 1) / pages.length) * 100)}%</span>
        </div>
        <div className={`h-1.5 rounded-full overflow-hidden mb-2 ${dark ? 'bg-white/10' : 'bg-corporate-bg'}`}>
          <div className="h-full rounded-full bg-corporate-hero transition-all" style={{ width: `${((pageIndex + 1) / pages.length) * 100}%` }} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {pages.map((p, i) => (
            <button
              key={i}
              onClick={() => setPageIndex(i)}
              title={p.title}
              aria-current={i === pageIndex ? 'step' : undefined}
              className={`w-7 h-7 shrink-0 rounded-lg text-[11px] font-bold flex items-center justify-center transition-colors ${
                i === pageIndex
                  ? 'bg-corporate-hero text-white'
                  : pageAck[i]
                  ? dark ? 'bg-corporate-hero/20 text-white/80' : 'bg-corporate-hero/10 text-corporate-hero'
                  : dark ? 'bg-white/5 text-white/40 hover:bg-white/10' : 'bg-corporate-bg text-gray-400 hover:bg-corporate-hero/10'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className={`rounded-2xl p-6 border min-h-[220px] ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
        {page.title === 'Mini Quiz' ? (
          <QuizSlide questions={quizQuestions} lessonId={lesson.id} token={token} dark={dark} />
        ) : (
          <PageBlocks blocks={page.blocks} dark={dark} />
        )}

        {page.title === 'Practice' && lesson.content_body.includes('### Practice Drill') && (
          <Link
            to={`/practise/drills?lesson=${lesson.id}`}
            className={`inline-flex items-center gap-2 text-sm font-medium mt-4 px-4 py-2.5 rounded-xl transition-colors ${
              dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-corporate-bg text-corporate-hero hover:bg-corporate-hero/10'
            }`}
          >
            <Dumbbell size={16} /> Practice this lesson →
          </Link>
        )}

        {!isLastPage && (
          <div className={`mt-6 pt-5 border-t ${dark ? 'border-white/10' : 'border-gray-100'}`}>
            <button
              onClick={() => setPageAck((prev) => ({ ...prev, [pageIndex]: !prev[pageIndex] }))}
              className={`w-full flex items-start gap-3 text-left rounded-xl p-3.5 transition-colors ${dark ? 'bg-white/5 hover:bg-white/10' : 'bg-corporate-bg hover:bg-corporate-hero/10'}`}
            >
              {acknowledgedCurrentPage ? <CheckSquare size={20} className="text-corporate-hero shrink-0 mt-0.5" /> : <Square size={20} className={`shrink-0 mt-0.5 ${mutedCls}`} />}
              <span className={`text-sm font-medium ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
                I understand this section and I'm ready to move on.
              </span>
            </button>
          </div>
        )}

        {page.title === 'Wrap-Up' && (
          <>
            <div className="flex flex-col gap-3 mt-5">
              <RecapPanel lessonId={lesson.id} dark={dark} />
              <RetrievalQuizWidget lessonId={lesson.id} dark={dark} />
              <FlashcardWidget lessonId={lesson.id} dark={dark} />
            </div>

            <div className={`mt-6 pt-5 border-t ${dark ? 'border-white/10' : 'border-gray-100'}`}>
              <button
                onClick={() => setUnderstood((v) => !v)}
                className={`w-full flex items-start gap-3 text-left rounded-xl p-3.5 transition-colors ${dark ? 'bg-white/5 hover:bg-white/10' : 'bg-corporate-bg hover:bg-corporate-hero/10'}`}
              >
                {understood ? <CheckSquare size={20} className="text-corporate-hero shrink-0 mt-0.5" /> : <Square size={20} className={`shrink-0 mt-0.5 ${mutedCls}`} />}
                <span className={`text-sm font-medium ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
                  I understand this stage and I'm ready to move on.
                </span>
              </button>

              {completeResult && (
                <p className={`text-sm mt-3 ${completeResult.ok ? 'text-emerald-500' : dark ? 'text-amber-300' : 'text-amber-600'}`}>
                  {completeResult.message}
                </p>
              )}

              <div className="flex flex-wrap gap-2 mt-3">
                {!completeResult?.ok ? (
                  <button
                    onClick={markComplete}
                    disabled={!understood || completing}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl bg-corporate-accent text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {completing ? 'Completing…' : 'Mark Stage Complete'}
                  </button>
                ) : (
                  <Link to={backHref} className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl bg-corporate-accent text-white">
                    Back to Track <ArrowRight size={15} />
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Back / Next / Skip / End Lesson — by direct request. */}
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button onClick={() => setPageIndex((i) => Math.max(0, i - 1))} disabled={pageIndex === 0} className={navBtnCls}>
          <ArrowLeft size={15} /> Back
        </button>
        <button
          onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
          disabled={isLastPage || !acknowledgedCurrentPage}
          title={!isLastPage && !acknowledgedCurrentPage ? "Check “I understand this section” above to continue" : undefined}
          className={navBtnCls}
        >
          Next <ArrowRight size={15} />
        </button>
        <button onClick={() => setPageIndex(pages.length - 1)} disabled={isLastPage} className={navBtnCls} title="Skip to the end of this lesson">
          <SkipForward size={15} /> Skip
        </button>
        <button
          onClick={() => navigate(backHref)}
          className={`ml-auto inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors ${dark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
          title="Exit this lesson without completing it"
        >
          <LogOut size={15} /> End Lesson
        </button>
      </div>
    </>
  );
}

/**
 * LessonPage — the actual reading view every other Learn page was
 * missing. GET /curriculum/tracks/{id} only ever returned the stage
 * list (title, XP, lock state); the practice/quiz/game endpoints each
 * parse one small subsection of a lesson (Practice Drill, Mini Quiz).
 * Nothing ever let a learner read a lesson's full authored content
 * (Core Teaching, Worked Example, Key Takeaways, etc.) until this page
 * and its backing endpoint (GET /curriculum/lessons/{id}). The actual
 * reading flow lives in LessonReader above — this component only
 * handles fetching and the loading/error states.
 */
export function LessonPage() {
  const { trackId, lessonId } = useParams<{ trackId: string; lessonId: string }>();
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const { token } = useAuth();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');
  // Powers the Stage nav header ("Stage 2 of 23" + Prev/Next Stage) —
  // failing silently to an empty list on error simply hides that nav
  // (see the `stages.length > 1` guard in LessonReader) rather than
  // blocking the lesson content itself from loading; the actual
  // content is the point of this page, the stage nav is a convenience
  // on top of it.
  const [stages, setStages] = useState<StageNavEntry[]>([]);

  useEffect(() => {
    if (!token || !lessonId) return;
    setLesson(null);
    setError(null);
    let detail: string | null = null;
    fetchJsonWithRetry<LessonDetail>(
      `${API_URL}/curriculum/lessons/${lessonId}`, { headers: { Authorization: `Bearer ${token}` } },
      setPhase, (d) => { detail = d; },
    ).then((d) => {
      if (d) setLesson(d);
      else setError(detail || 'Could not load this lesson right now.');
    });
  }, [token, lessonId]);

  useEffect(() => {
    if (!token || !trackId) return;
    apiFetch(`${API_URL}/curriculum/tracks/${trackId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStages(d?.stages ?? []))
      .catch(() => setStages([]));
  }, [token, trackId]);

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
        (phase === 'loading' || phase === 'stalled')
          ? <LoadingIndicator phase={phase} dark={dark} />
          : <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Loading lesson…</p>
      )}

      {lesson && (
        lesson.content_body
          ? <LessonReader lesson={lesson} trackId={trackId} stages={stages} dark={dark} />
          : (
            <>
              <PageHeader title={lesson.title} subtitle={`${lesson.track_title} · Stage ${lesson.stage_number}: ${lesson.stage_title}`} />
              <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Not yet authored.</p>
            </>
          )
      )}
    </div>
  );
}
