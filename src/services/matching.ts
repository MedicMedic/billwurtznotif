import { QAEntry, WatchedQuestion } from '../types';

// Lowercase, strip punctuation, collapse whitespace — so a pasted question
// still matches after bill reformats it (curly quotes, line breaks, etc).
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesEntry(wq: WatchedQuestion, entry: QAEntry): boolean {
  const nText = normalize(wq.text);
  const nQuestion = normalize(entry.question);

  // Full-question match: the pasted question appears inside the posted one,
  // or vice versa (bill sometimes trims long questions). Length guard keeps
  // short strings like "hi" from matching everything.
  if (
    nText.length >= 12 &&
    nQuestion.length >= 12 &&
    (nQuestion.includes(nText) || nText.includes(nQuestion))
  ) {
    return true;
  }

  // Keyword match (comma-separated): every keyword must appear in Q+A.
  const full = normalize(`${entry.question} ${entry.answer}`);
  return wq.keywords.length > 0 && wq.keywords.every(kw => full.includes(normalize(kw)));
}
