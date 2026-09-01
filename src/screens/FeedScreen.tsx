import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl,
} from 'react-native';
import { QAEntry, WatchedQuestion } from '../types';
import { getAllEntries, getLastCheck, getWatched } from '../services/storage';
import { runCheck } from '../tasks/backgroundFetch';
import { matchesEntry } from '../services/matching';
import QuestionCard from '../components/QuestionCard';

function timeAgo(ts: number | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function FeedScreen() {
  const [entries, setEntries] = useState<QAEntry[]>([]);
  const [watched, setWatched] = useState<WatchedQuestion[]>([]);
  const [lastCheck, setLastCheckTs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [e, lc, w] = await Promise.all([getAllEntries(), getLastCheck(), getWatched()]);
    setEntries(e);
    setWatched(w);
    setLastCheckTs(lc);
    return e;
  }, []);

  useEffect(() => {
    (async () => {
      const cached = await load();
      // Nothing stored yet? Fetch the live site immediately so there's content to scroll.
      if (cached.length === 0) await checkNow();
    })().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const checkNow = async () => {
    setChecking(true);
    setError(null);
    setCheckResult(null);
    try {
      const { newCount } = await runCheck();
      await load();
      setCheckResult(
        newCount > 0
          ? `found ${newCount} new answer${newCount !== 1 ? 's' : ''}!`
          : 'no new answers yet'
      );
    } catch (err: any) {
      setError(err?.message || 'check failed');
    } finally {
      setChecking(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await checkNow();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>bill wurtz q&a</Text>
        <View style={styles.headerRow}>
          <Text style={styles.meta}>checked {timeAgo(lastCheck)}</Text>
          <TouchableOpacity
            style={[styles.checkBtn, checking && styles.checkBtnBusy]}
            onPress={checkNow}
            disabled={checking}
          >
            {checking
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.checkBtnText}>check now</Text>}
          </TouchableOpacity>
        </View>
        {!!checkResult && !error && (
          <Text style={styles.result}>{checkResult}</Text>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#00FF00" />
      ) : entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>no new answers detected yet</Text>
          <Text style={styles.emptySub}>
            tap "check now" to do an initial check.{'\n'}
            new answers will appear here automatically.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={e => e.id}
          renderItem={({ item }) => (
            <QuestionCard
              entry={item}
              isMine={watched.some(wq => matchesEntry(wq, item))}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#323232' },
  header: { padding: 16, paddingTop: 20, backgroundColor: '#232323' },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 10, letterSpacing: -0.5 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { color: '#E9EC54', fontSize: 13 },
  checkBtn: {
    backgroundColor: '#000', borderRadius: 8,
    borderWidth: 1, borderColor: '#00EE3B',
    paddingHorizontal: 16, paddingVertical: 8,
    minWidth: 110, alignItems: 'center',
  },
  checkBtnBusy: { borderColor: '#555' },
  checkBtnText: { color: '#00FF00', fontWeight: '700', fontSize: 14 },
  result: { color: '#b3ffb3', marginTop: 8, fontSize: 13 },
  error: { color: '#ff6666', marginTop: 8, fontSize: 13 },
  loader: { marginTop: 80 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, color: '#ccc', textAlign: 'center', marginBottom: 10, fontWeight: '600' },
  emptySub: { fontSize: 13, color: '#999', textAlign: 'center', lineHeight: 20 },
  list: { padding: 12, paddingTop: 14 },
});
