/**
 * quizParser — turns a lesson's own real "### Mini Quiz" section text
 * (already authored, verified consistent across every lesson in this
 * curriculum: "Q1 (True/False): ...\nAnswer: True — explanation." /
 * "Q2 (Multiple choice): ...\n(a) ...\n(b) ...\nAnswer: (b).") into
 * structured questions QuizSlide can actually render as clickable
 * options — before this, the Mini Quiz section rendered as flat text
 * with its own answer already printed right below the question, by
 * direct bug report ("questions or quizzes should have the question
 * with multiple answer format ... wait for user or trainee input and
 * show answers or explanations").
 */
export interface QuizQuestion {
  id: string;
  type: 'tf' | 'mc';
  prompt: string;
  options?: string[];        // 'mc' only
  correctIndex?: number;     // 'mc' only, 0-based
  correctBool?: boolean;     // 'tf' only
  explanation: string;
}

export function parseMiniQuiz(sectionText: string): QuizQuestion[] {
  const chunks = sectionText.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean);
  const questions: QuizQuestion[] = [];
  let current: (Partial<QuizQuestion> & { type: 'tf' | 'mc' }) | null = null;

  for (const chunk of chunks) {
    const qMatch = chunk.match(/^Q(\d+)\s*\((True\/False|Multiple choice)\):\s*([\s\S]+)$/i);
    if (qMatch) {
      const [, num, kind, rest] = qMatch;
      const lines = rest.split('\n').map((l) => l.trim()).filter(Boolean);
      const optionLines = lines.filter((l) => /^\([a-d]\)/i.test(l));
      const questionLines = lines.filter((l) => !/^\([a-d]\)/i.test(l));
      current = {
        id: `q${num}`,
        type: /true\/false/i.test(kind) ? 'tf' : 'mc',
        prompt: questionLines.join(' ').trim(),
        options: optionLines.length ? optionLines.map((l) => l.replace(/^\([a-d]\)\s*/i, '')) : undefined,
      };
      continue;
    }

    const aMatch = chunk.match(/^Answer:\s*([\s\S]+)$/i);
    if (aMatch && current) {
      const answerText = aMatch[1].replace(/\n/g, ' ').trim();
      if (current.type === 'tf') {
        const boolMatch = answerText.match(/^(True|False)\b\.?\s*[—-]?\s*(.*)$/i);
        current.correctBool = boolMatch ? /^true$/i.test(boolMatch[1]) : /true/i.test(answerText);
        current.explanation = boolMatch?.[2]?.trim() || answerText;
      } else {
        const letterMatch = answerText.match(/^\(([a-d])\)\.?\s*[—-]?\s*(.*)$/i);
        if (letterMatch) {
          current.correctIndex = letterMatch[1].toLowerCase().charCodeAt(0) - 97;
          current.explanation = letterMatch[2]?.trim() || '';
        } else {
          current.explanation = answerText;
        }
      }
      if (current.prompt) questions.push(current as QuizQuestion);
      current = null;
    }
  }
  return questions;
}
