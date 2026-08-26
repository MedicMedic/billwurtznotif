import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { QAEntry } from '../types';
import RichText from './RichText';
import { localTimeSuffix } from '../utils/billTime';

function timeAgo(ts?: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function QuestionCard({ entry, isMine }: { entry: QAEntry; isMine?: boolean }) {
  const localSuffix = localTimeSuffix(entry.date);
  return (
    <View style={[styles.card, isMine && styles.cardMine]}>
      {(!!entry.date || !!entry.detectedAt || isMine) && (
        <View style={styles.topRow}>
          {isMine ? (
            <View style={styles.mineBadge}>
              <Text style={styles.mineBadgeText}>YOUR QUESTION</Text>
            </View>
          ) : <View />}
          <Text style={styles.time}>
            {entry.date || ''}
            {!!localSuffix && `  ${localSuffix}`}
            {!!entry.detectedAt && (entry.date ? '  ·  ' : '') + `new ${timeAgo(entry.detectedAt)}`}
          </Text>
        </View>
      )}
      <View style={styles.row}>
        <View style={[styles.pill, styles.qPill]}>
          <Text style={styles.pillText}>Q</Text>
        </View>
        <RichText
          text={entry.question}
          style={styles.questionText}
          linkStyle={styles.link}
          emptyText="(no question text)"
        />
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <View style={[styles.pill, styles.aPill]}>
          <Text style={styles.pillText}>A</Text>
        </View>
        <RichText
          text={entry.answer}
          style={styles.answerText}
          linkStyle={styles.link}
          emptyText="not answered yet"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#444',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#000',
    elevation: 2,
  },
  cardMine: { borderColor: '#00EE3B', borderWidth: 2 },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  mineBadge: { backgroundColor: '#00EE3B', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  mineBadgeText: { color: '#000', fontSize: 10, fontWeight: '800' },
  time: { fontSize: 11, color: '#E9EC54', textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  pill: {
    width: 22,
    height: 22,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  qPill: { backgroundColor: '#B387FF' },
  aPill: { backgroundColor: '#fff' },
  pillText: { color: '#000', fontSize: 12, fontWeight: '800' },
  questionText: { flex: 1, fontSize: 15, color: '#B387FF', fontWeight: '500', lineHeight: 22 },
  answerText: { flex: 1, fontSize: 15, color: '#fff', lineHeight: 22 },
  link: { color: '#00EE3B', textDecorationLine: 'underline' },
  divider: { height: 1, backgroundColor: '#555', marginVertical: 10 },
});
