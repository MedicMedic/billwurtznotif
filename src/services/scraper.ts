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

// Named entities beyond the basic markup ones (&amp; &lt; &gt; &quot; &#39;
// are handled generically below as numeric/named lookups). billwurtz.com
// escapes non-ASCII output, so accented letters and punctuation come back
// as either numeric refs (&#233;) or these named ones.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  aacute: 'á', agrave: 'à', acirc: 'â', auml: 'ä', atilde: 'ã', aring: 'å',
  iacute: 'í', igrave: 'ì', icirc: 'î', iuml: 'ï',
  oacute: 'ó', ograve: 'ò', ocirc: 'ô', ouml: 'ö', otilde: 'õ',
  uacute: 'ú', ugrave: 'ù', ucirc: 'û', uuml: 'ü',
  ntilde: 'ñ', ccedil: 'ç', yacute: 'ý', yuml: 'ÿ',
  Eacute: 'É', Egrave: 'È', Aacute: 'Á', Agrave: 'À', Ntilde: 'Ñ', Ccedil: 'Ç',
  Uuml: 'Ü', Ouml: 'Ö', Auml: 'Ä', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  szlig: 'ß', oslash: 'ø', Oslash: 'Ø', aelig: 'æ', AElig: 'Æ',
  hellip: '…', mdash: '—', ndash: '–',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => codePointToChar(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => codePointToChar(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m);
}

function codePointToChar(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

const BASE_URL = 'https://billwurtz.com/questions/';

function resolveUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/')) return 'https://billwurtz.com' + href;
  return BASE_URL + href;
}

// Turn <a href="...">text</a> into markdown-style [text](url) *before* tags
// are stripped, so the link survives into the app instead of collapsing to
// plain, unclickable text.
function extractLinks(s: string): string {
  return s.replace(
    /<a\s+href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, label) => `[${label.replace(/<[^>]+>/g, '').trim()}](${resolveUrl(decodeEntities(href))})`
  );
}

function clean(s: string): string {
  return decodeEntities(
    extractLinks(s).replace(/<[^>]+>/g, ' ')
  )
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
