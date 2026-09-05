import { useState } from 'react';
import { Brain, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';
import { apiFetch } from './AccessExpiredGate';
import { LoadingIndicator } from './LoadingIndicator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Question { id: string; prompt: string; type: 'knowledge' | 'scenario' }
type Confidence = 'not_sure' | 'fairly_sure' | 'very_sure';

const CONFIDENCE_OPTIONS: { value: Confidence; label: string }[] = [
  { value: 'not_sure', label: 'Not sure' },
  { value: 'fairly_sure', label: 'Fairly sure' },
  { value: 'very_sure', label: 'Very sure' },
];

/**
 * RetrievalQuizWidget — Section 6 of the Learning Design Spec. Shown
 * inline after a lesson's content (LessonPage), collapsed until
 * requested — a quick-check, not a graded assessment (RQ02: never
 * touches assessmentScore). Flow per question, strictly in order:
 * 1. Read prompt.
 * 2. Pick a confidence level BEFORE the answer is shown (RQ03: can't
 *    submit without one — the Reveal button stays disabled).
 * 3. Answer revealed; trainee self-grades against it (same self-graded
 *    pattern PracticeAttempt's drills already use elsewhere).
 */
export function RetrievalQuizWidget({ lessonId, dark }: { lessonId: string; dark: boolean }) {
  const { token } = useAuth();
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');
  const [index, setIndex] = useState(0);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [revealed, setRevealed] = useState<{ responseId: string; correctAnswer: string } | null>(null);
  const [done, setDone] = useState(0);

  function handleStart() {
    setStarted(true);
    setError(null);
    fetchJsonWithRetry<{ questions: Question[] }>(
      `${API_URL}/curriculum/lessons/${lessonId}/retrieval-quiz`,
      { headers: { Authorization: `Bearer ${token}` } },
      setPhase,
    ).then((r) => {
      if (r) setQuestions(r.questions);
      else setError("A quick check isn't available for this lesson right now.");
    });
  }

  async function reveal() {
    if (!confidence || !questions) return;
    const q = questions[index];
    const res = await apiFetch(`${API_URL}/curriculum/lessons/${lessonId}/retrieval-quiz/confidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question_id: q.id, confidence }),
    });
    if (res.ok) {
      const data = await res.json();
      setRevealed({ responseId: data.response_id, correctAnswer: data.correct_answer });
    }
  }

  async function grade(correct: boolean) {
    if (!revealed) return;
    await apiFetch(`${API_URL}/curriculum/retrieval-quiz/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ response_id: revealed.responseId, self_reported_correct: correct }),
    }).catch(() => {});
    setDone((d) => d + 1);
    if (questions && index + 1 < questions.length) {
      setIndex((i) => i + 1);
      setConfidence(null);
      setRevealed(null);
    } else {
      setQuestions(null); // finished — collapse back to a "done" state below
    }
  }

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';

  if (!started) {
    return (
      <button
        onClick={handleStart}
        className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors ${
          dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-corporate-bg text-corporate-hero hover:bg-corporate-hero/10'
        }`}
      >
        <Brain size={16} /> Quick check — test your recall
      </button>
    );
  }

  return (
    <div className={`rounded-2xl p-5 border mt-3 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Brain size={16} className={dark ? 'text-white/60' : 'text-corporate-hero'} />
        <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Quick check</span>
        <span className={`text-xs ${mutedCls}`}>— ungraded, just for you</span>
      </div>

      {!questions && !error && done === 0 && <LoadingIndicator phase={phase} dark={dark} />}
      {error && <p className={`text-sm ${dark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>}

      {!questions && done > 0 && (
        <p className={`text-sm ${dark ? 'text-white/60' : 'text-gray-600'}`}>
          Done — {done} question{done === 1 ? '' : 's'} reviewed. Nice work.
        </p>
      )}

      {questions && questions[index] && (
        <div>
          <p className={`text-xs mb-1 ${mutedCls}`}>Question {index + 1} of {questions.length}</p>
          <p className={`text-sm font-medium mb-4 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{questions[index].prompt}</p>

          {!revealed ? (
            <>
              <p className={`text-xs mb-2 ${mutedCls}`}>How confident are you?</p>
              <div className="flex gap-2 mb-4">
                {CONFIDENCE_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setConfidence(c.value)}
                    className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${
                      confidence === c.value
                        ? 'bg-corporate-hero text-white border-corporate-hero'
                        : dark ? 'border-corporate-border-dark text-white/60' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <button
                onClick={reveal}
                disabled={!confidence}
                className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-xl bg-corporate-hero disabled:opacity-40"
              >
                Reveal answer <ChevronRight size={14} />
              </button>
            </>
          ) : (
            <>
              <div className={`rounded-xl p-3 mb-3 text-sm ${dark ? 'bg-white/5 text-white/80' : 'bg-corporate-bg text-corporate-text-on-bg'}`}>
                {revealed.correctAnswer}
              </div>
              <p className={`text-xs mb-2 ${mutedCls}`}>Did you get it right?</p>
              <div className="flex gap-2">
                <button onClick={() => grade(true)} className="flex-1 text-xs font-semibold py-2 rounded-lg bg-emerald-500/15 text-emerald-600">Got it right</button>
                <button onClick={() => grade(false)} className="flex-1 text-xs font-semibold py-2 rounded-lg bg-amber-500/15 text-amber-600">Got it wrong</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
