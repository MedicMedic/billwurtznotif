// Question/answer text from the scraper embeds links as markdown-style
// [label](url) — this is the single place that recognizes that syntax.
export const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

// For contexts that can't render tappable links (notifications, alerts):
// collapse [label](url) down to just the visible label.
export function plainText(s: string): string {
  return s.replace(LINK_RE, '$1');
}
