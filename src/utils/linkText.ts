// Question/answer text from the scraper embeds links as markdown-style
// [label](url) — this is the single place that recognizes that syntax.
export const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

// Inline style spans (bold/italic/underline/color/size, from scraper.ts's
// richify()) are delimited with Private Use Area code points so they can
// never collide with real page text: STYLE_OPEN starts a span with its
// encoded props, STYLE_PROPS_END ends the props and starts the span's
// content, STYLE_CLOSE ends the span. RichText is the only place that
// parses these into actual styling.
//
// Built via String.fromCharCode rather than written as literal characters:
// invisible Private Use Area code points are too easy to silently mangle
// (or strip) when they're just sitting raw in source text.
export const STYLE_OPEN = String.fromCharCode(0xE000);
export const STYLE_PROPS_END = String.fromCharCode(0xE001);
export const STYLE_CLOSE = String.fromCharCode(0xE002);

const STYLE_TAG_RE = new RegExp(
  STYLE_OPEN + '[^' + STYLE_PROPS_END + ']*' + STYLE_PROPS_END + '|' + STYLE_CLOSE,
  'g'
);

// For contexts that can't render tappable/styled text (notifications, alerts):
// collapse [label](url) down to just the visible label, and drop style markers.
export function plainText(s: string): string {
  return s.replace(LINK_RE, '$1').replace(STYLE_TAG_RE, '');
}
