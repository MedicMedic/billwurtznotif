import React from 'react';
import { Text, Linking, StyleProp, TextStyle, StyleSheet } from 'react-native';
import { STYLE_OPEN, STYLE_PROPS_END, STYLE_CLOSE } from '../utils/linkText';

// Matches, in order of priority: a markdown-style link, a style-span open
// tag (captures its encoded props), or a bare style-span close marker.
// Built with string concatenation (not a template literal / regex literal)
// so the Private-Use-Area marker characters only ever exist as the runtime
// values imported from linkText.ts, never as raw characters in source.
const TOKEN_RE = new RegExp(
  '\\[([^\\]]+)\\]\\((https?://[^\\s)]+)\\)|' +
  STYLE_OPEN + '([^' + STYLE_PROPS_END + ']*)' + STYLE_PROPS_END + '|' +
  STYLE_CLOSE,
  'g'
);

// Decodes one encoded prop ("b", "i", "u", "c#rrggbb", "s<em multiplier>",
// see scraper.ts's styleProps()) into the RN style it represents. Size is
// relative to the caller's base font size so it scales with context.
function propStyle(props: string, baseFontSize: number): TextStyle {
  switch (props[0]) {
    case 'b': return { fontWeight: 'bold' };
    case 'i': return { fontStyle: 'italic' };
    case 'u': return { textDecorationLine: 'underline' };
    case 'c': return { color: props.slice(1) };
    case 's': return { fontSize: baseFontSize * (parseFloat(props.slice(1)) || 1) };
    default: return {};
  }
}

export default function RichText({
  text, style, linkStyle, emptyText,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  emptyText?: string;
}) {
  if (!text) {
    return emptyText ? <Text style={[style, { fontStyle: 'italic', opacity: 0.6 }]}>{emptyText}</Text> : null;
  }

  const flatBaseStyle = StyleSheet.flatten(style);
  const baseFontSize = flatBaseStyle?.fontSize ?? 15;
  const flatLinkStyle = linkStyle ? StyleSheet.flatten(linkStyle) : undefined;

  const parts: React.ReactNode[] = [];
  const styleStack: TextStyle[] = [];
  let key = 0;
  let lastIndex = 0;
  // A style span's enlarged fontSize can get its descenders (e.g. "q", "y")
  // clipped by the card's fixed lineHeight, which doesn't grow to fit a
  // taller nested run on Android. Track the largest size multiplier seen so
  // the outer Text's lineHeight can be scaled up to give it room.
  let maxSizeMultiplier = 1;
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  const activeStyle = (): TextStyle | undefined =>
    styleStack.length ? Object.assign({}, ...styleStack) : undefined;

  const flushText = (chunk: string) => {
    if (!chunk) return;
    parts.push(<Text key={key++} style={activeStyle()}>{chunk}</Text>);
  };

  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) flushText(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      const [, label, url] = match;
      parts.push(
        <Text
          key={key++}
          style={Object.assign({}, activeStyle(), flatLinkStyle)}
          onPress={() => Linking.openURL(url)}
        >
          {label}
        </Text>
      );
    } else if (match[3] !== undefined) {
      const props = match[3];
      if (props[0] === 's') {
        maxSizeMultiplier = Math.max(maxSizeMultiplier, parseFloat(props.slice(1)) || 1);
      }
      styleStack.push(propStyle(props, baseFontSize));
    } else {
      styleStack.pop();
    }
    lastIndex = match.index + match[0].length;
    // Guard against a zero-length match (shouldn't happen with well-formed
    // markup, but would otherwise spin exec() forever at the same index).
    if (match[0].length === 0) TOKEN_RE.lastIndex++;
  }
  if (lastIndex < text.length) flushText(text.slice(lastIndex));

  const outerStyle = flatBaseStyle?.lineHeight && maxSizeMultiplier > 1
    ? [style, { lineHeight: flatBaseStyle.lineHeight * maxSizeMultiplier }]
    : style;

  return <Text style={outerStyle}>{parts}</Text>;
}
