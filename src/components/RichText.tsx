import React from 'react';
import { Text, Linking, StyleProp, TextStyle } from 'react-native';
import { LINK_RE } from '../utils/linkText';

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

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  LINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LINK_RE.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const [full, label, url] = match;
    parts.push(
      <Text key={key++} style={linkStyle} onPress={() => Linking.openURL(url)}>
        {label}
      </Text>
    );
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <Text style={style}>{parts}</Text>;
}
