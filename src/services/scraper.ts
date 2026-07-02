import { QAEntry } from '../types';

const PAGE_URL = 'https://billwurtz.com/questions/questions.html';
const ASK_URL = 'https://billwurtz.com/questions/questions.php';

// Submits a question through the same form the website uses
// (<form action="questions.php" method="post"> with a "question" field).
export async function askQuestion(text: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(ASK_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'question=' + encodeURIComponent(text).replace(/%20/g, '+'),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).padStart(8, '0').slice(0, 8);
}

function clean(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchQuestions(): Promise<QAEntry[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(PAGE_URL, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    return parseEntries(html);
  } finally {
    clearTimeout(timeoutId);
  }
}

// billwurtz.com/questions formats each entry as:
//   <h3> <dco>DATE TIME</dco> &nbsp;<qco>QUESTION</qco> </h3> ANSWER </br></br>
// The date/question live in <dco>/<qco> tags; the answer is the text that
// follows the closing </qco>...</h3> up to the next entry's <dco>.
function parseEntries(html: string): QAEntry[] {
  const entries: QAEntry[] = [];
  const re = /<dco>([\s\S]*?)<\/dco>[\s\S]*?<qco>([\s\S]*?)<\/qco>([\s\S]*?)(?=<dco>|<\/body>|$)/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const date = clean(m[1]);
    const question = clean(m[2]);
    const answer = clean(m[3]);
    if (question || answer) {
      // id is stable across fetches (date+question) so "seen" tracking works
      entries.push({ id: simpleHash(date + question), question, answer, date });
    }
  }

  return entries;
}
