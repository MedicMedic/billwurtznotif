import { decode as decodeEntities } from 'he';
import { QAEntry } from '../types';
import { STYLE_OPEN, STYLE_PROPS_END, STYLE_CLOSE } from '../utils/linkText';

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

const RANDOM_URL = 'https://billwurtz.com/questions/random.php';

// One random entry from the site's "i'm feeling randy" page. The server sends
// max-age=600, so a throwaway query param keeps each fetch fresh.
export async function fetchRandom(): Promise<QAEntry> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(`${RANDOM_URL}?_=${Date.now()}`, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const entry = parseEntries(await resp.text())[0];
    if (!entry) throw new Error('no question found');
    return entry;
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

const BASE_URL = 'https://billwurtz.com/questions/';

function resolveUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/')) return 'https://billwurtz.com' + href;
  return BASE_URL + href;
}

// Tags that separate words when stripped (line breaks, block boundaries).
const BLOCK_TAGS = new Set(['br', 'p', 'div', 'li', 'tr']);
// Tags that carry inline styling worth keeping (bold/italic/underline/color/size).
const STYLE_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'font', 'span']);

function normalizeColor(c: string): string {
  return /^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(c) ? '#' + c : c;
}

// Reads the style-relevant attributes off one opening tag (color/font-weight/
// font-style/text-decoration/font-size, whether given directly or via a
// `style="..."` attribute) and returns them as short encoded prop strings
// ("b", "i", "u", "c#rrggbb", "s<em multiplier>") for richify() to emit.
function styleProps(tag: string, attrs: string): string[] {
  const props: string[] = [];
  if (tag === 'b' || tag === 'strong') props.push('b');
  if (tag === 'i' || tag === 'em') props.push('i');
  if (tag === 'u') props.push('u');
  const colorAttr = /\bcolor\s*=\s*["']?(#?[0-9a-fA-F]{3,6}|[a-zA-Z]+)["']?/i.exec(attrs);
  if (colorAttr) props.push('c' + normalizeColor(colorAttr[1]));
  const styleAttr = /\bstyle\s*=\s*["']([^"']*)["']/i.exec(attrs);
  if (styleAttr) {
    const style = styleAttr[1];
    const color = /color\s*:\s*([^;]+)/i.exec(style);
    if (color) props.push('c' + normalizeColor(color[1].trim()));
    const em = /font-size\s*:\s*([\d.]+)\s*em/i.exec(style);
    if (em) props.push('s' + em[1]);
    if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(style)) props.push('b');
    if (/font-style\s*:\s*italic/i.test(style)) props.push('i');
    if (/text-decoration\s*:\s*underline/i.test(style)) props.push('u');
  }
  return props;
}

// Converts a raw HTML fragment into plain text with two kinds of embedded
// markup, both designed to survive JSON storage and matching.normalize()
// untouched (or collapse harmlessly) when styling isn't needed:
//  - links: [label](url), same markdown-style convention as before.
//  - inline styles: STYLE_OPEN + props + STYLE_PROPS_END ... STYLE_CLOSE,
//    delimited with Private Use Area code points so they can never collide
//    with real page text. RichText renders these; everything else (like
//    matching.normalize, which strips non-alphanumerics) just ignores them.
// <a> tags are captured non-recursively (mirrors the old extractLinks
// behavior); style tags use a stack so nesting - e.g. the bold+2em wrapper
// around a solo green "q" in "ue<font color=green>q</font>stions" - renders
// correctly instead of collapsing to plain, unstyled text.
function richify(raw: string): string {
  let out = '';
  const stack: number[] = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m[4] !== undefined) {
      out += decodeEntities(m[4]);
      continue;
    }
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] || '';

    if (!closing && tag === 'a') {
      const rest = raw.slice(re.lastIndex);
      const closeMatch = /<\/a\s*>/i.exec(rest);
      const label = closeMatch ? rest.slice(0, closeMatch.index) : rest;
      re.lastIndex += closeMatch ? closeMatch.index + closeMatch[0].length : rest.length;
      const hrefMatch = /href\s*=\s*["']([^"']*)["']/i.exec(attrs);
      const cleanLabel = decodeEntities(label.replace(/<[^>]+>/g, '')).trim();
      out += hrefMatch ? `[${cleanLabel}](${resolveUrl(decodeEntities(hrefMatch[1]))})` : cleanLabel;
      continue;
    }

    if (BLOCK_TAGS.has(tag)) {
      out += ' ';
      continue;
    }

    if (STYLE_TAGS.has(tag)) {
      if (!closing) {
        const props = styleProps(tag, attrs);
        props.forEach(p => { out += STYLE_OPEN + p + STYLE_PROPS_END; });
        stack.push(props.length);
      } else {
        const n = stack.pop() ?? 0;
        for (let k = 0; k < n; k++) out += STYLE_CLOSE;
      }
    }
    // any other tag (h3, dco, qco, stray markup) is dropped without affecting the stack
  }
  return out;
}

function clean(s: string): string {
  return richify(s).replace(/\s+/g, ' ').trim();
}

async function fetchPage(url: string): Promise<{ entries: QAEntry[]; prev: string | null }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    // Each page (current month, then monthly archives) links to the one before it.
    const prev = /<a\s+href="([^"]+)"[^>]*>\s*PREVIOUS QUESTIONS/i.exec(html);
    return { entries: parseEntries(html), prev: prev ? prev[1] : null };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchQuestions(): Promise<QAEntry[]> {
  return (await fetchPage(PAGE_URL)).entries;
}

// Walks back through the monthly archives one page at a time. Pass null to
// start from the current page; `prev` is the cursor for the next call, or
// null once the oldest archive has been reached.
export async function fetchArchivePage(
  cursor: string | null
): Promise<{ entries: QAEntry[]; prev: string | null }> {
  if (cursor === null) {
    const { prev } = await fetchPage(PAGE_URL);
    if (!prev) return { entries: [], prev: null };
    cursor = prev;
  }
  const page = await fetchPage(resolveUrl(cursor));
  return page;
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
