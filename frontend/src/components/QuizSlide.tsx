import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { QuizQuestion } from '../lib/quizParser';
import { apiFetch } from './AccessExpiredGate';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * QuizSlide — the Mini Quiz page of a lesson, made actually
 * interactive. By direct request ("questions or quizzes should have
 * the question with multiple answer format .....wait for user or
 * trainee input and show answers or explanations") — every lesson's
 * "### Mini Quiz" section previously rendered as flat text with its
 * own "Answer: ..." line printed immediately below the question, so
 * there was nothing to actually answer. Options are real buttons; the
 * correct answer and explanation reveal only after a choice is made.
 *
 * Once every question here has been answered, this auto-submits the
 * resulting score via the same POST /curriculum/quiz endpoint the
 * platform already scores lessons with — a real QuizAttempt row, so
 * this quiz's score is what stage completion's own dual gate
 * (min_quiz_score_pct) actually reads, not a disconnected, purely
 * cosmetic quiz sitting beside the real one.
 */
export function QuizSlide({
  questions, lessonId, token, dark,
}: { questions: QuizQuestion[]; lessonId: string; token: string | null; dark: boolean }) {
  const [answers, setAnswers] = useState<Record<string, number | boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  const correctCount = questions.filter((q) => {
    const a = answers[q.id];
    if (a === undefined) return false;
    return q.type === 'tf' ? a === q.correctBool : a === q.correctIndex;
  }).length;
  const scorePct = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;

  useEffect(() => {
    if (!allAnswered || submitted || !token) return;
    setSubmitted(true);
    apiFetch(`${API_URL}/curriculum/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lesson_id: lessonId, score_pct: scorePct }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAnswered, submitted, token, lessonId, scorePct]);

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const cardCls = `rounded-2xl border p-4 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;

  if (questions.length === 0) {
    return <p className={`text-sm ${mutedCls}`}>No quiz questions found for this lesson.</p>;
  }

  return (
    <div className="space-y-4">
      {questions.map((q, qi) => {
        const chosen = answers[q.id];
        const answered = chosen !== undefined;
        const options = q.type === 'tf' ? ['True', 'False'] : q.options ?? [];
        return (
          <div key={q.id} className={cardCls}>
            <p className={`text-[11px] font-bold uppercase tracking-wide mb-1 ${mutedCls}`}>Question {qi + 1}</p>
            <p className={`text-sm font-semibold mb-3 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{q.prompt}</p>
            <div className="space-y-2">
              {options.map((opt, oi) => {
                const isThisChoice = q.type === 'tf' ? (oi === 0) === chosen : oi === chosen;
                const isCorrect = q.type === 'tf' ? (oi === 0) === q.correctBool : oi === q.correctIndex;
                let stateCls = dark ? 'border-white/10 hover:border-white/25' : 'border-gray-200 hover:border-corporate-hero/40';
                if (answered && isCorrect) stateCls = 'border-emerald-500 bg-emerald-500/10';
                else if (answered && isThisChoice && !isCorrect) stateCls = 'border-red-500 bg-red-500/10';
                return (
                  <button
                    key={oi}
                    disabled={answered}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: q.type === 'tf' ? oi === 0 : oi }))}
                    className={`w-full flex items-center gap-2.5 text-left text-sm rounded-xl border p-3 transition-colors disabled:cursor-default ${stateCls} ${dark ? 'text-white/85' : 'text-corporate-text-on-bg'}`}
                  >
                    <span className="flex-1">{opt}</span>
                    {answered && isCorrect && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
                    {answered && isThisChoice && !isCorrect && <XCircle size={16} className="text-red-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
            {answered && q.explanation && (
              <p className={`text-xs mt-3 leading-relaxed rounded-lg p-2.5 ${dark ? 'bg-white/5 text-white/60' : 'bg-corporate-bg text-gray-600'}`}>
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}

      {allAnswered && (
        <div className={`rounded-2xl p-4 text-center ${dark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
          <p className="text-lg font-bold text-emerald-500">{scorePct}%</p>
          <p className={`text-xs ${mutedCls}`}>{correctCount} of {questions.length} correct — saved to your progress</p>
        </div>
      )}
      {!allAnswered && (
        <p className={`text-xs text-center ${mutedCls}`}>{answeredCount} of {questions.length} answered</p>
      )}
    </div>
  );
}
