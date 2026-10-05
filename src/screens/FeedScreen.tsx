import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl,
} from 'react-native';
import { QAEntry, WatchedQuestion } from '../types';
import { getAllEntries, getLastCheck, getWatched, getBookmark, setBookmark } from '../services/storage';
import { fetchArchivePage } from '../services/scraper';
import { runCheck } from '../tasks/backgroundFetch';
import { matchesEntry } from '../services/matching';
import QuestionCard from '../components/QuestionCard';

// Cards rendered per page; the rest load as the list is scrolled.
const PAGE_SIZE = 40;

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Older monthly archives, loaded on demand once the current page runs out.
  // Kept in memory only; archiveCursor null = not started, undefined = exhausted.
  const [archive, setArchive] = useState<QAEntry[]>([]);
  const [archiveCursor, setArchiveCursor] = useState<string | null | undefined>(null);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const listRef = useRef<FlatList<QAEntry>>(null);

  const load = useCallback(async () => {
    const [e, lc, w, b] = await Promise.all([
      getAllEntries(), getLastCheck(), getWatched(), getBookmark(),
    ]);
    setBookmarkId(b);
    setEntries(e);
    setWatched(w);
    setLastCheckTs(lc);
    return e;
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      // Always refresh on open so the stored list covers the whole live page.
      await checkNow();
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

  const all = React.useMemo(() => {
    const ids = new Set(entries.map(e => e.id));
    return [...entries, ...archive.filter(e => !ids.has(e.id))];
  }, [entries, archive]);

  const loadMore = async () => {
    if (visibleCount < all.length) {
      setVisibleCount(c => Math.min(c + PAGE_SIZE, all.length));
      return;
    }
    if (loadingArchive || archiveCursor === undefined) return;
    setLoadingArchive(true);
    try {
      const page = await fetchArchivePage(archiveCursor);
      setArchive(a => [...a, ...page.entries]);
      setArchiveCursor(page.prev ?? undefined);
      setVisibleCount(c => c + PAGE_SIZE);
    } catch (err: any) {
      setError(err?.message || "couldn't load older questions");
    } finally {
      setLoadingArchive(false);
    }
  };

  const toggleBookmark = async (id: string) => {
    const next = bookmarkId === id ? null : id;
    setBookmarkId(next);
    await setBookmark(next);
  };

  const jumpToTop = () => listRef.current?.scrollToOffset({ offset: 0, animated: true });

  const jumpToBookmark = () => {
    const idx = all.findIndex(e => e.id === bookmarkId);
    if (idx < 0) {
      setError("bookmarked question isn't loaded (it may be in an older archive, keep scrolling)");
      return;
    }
    setError(null);
    // make sure the bookmarked row is rendered, then scroll once layout has caught up
    setVisibleCount(c => Math.max(c, idx + PAGE_SIZE));
    setTimeout(() => listRef.current?.scrollToIndex({ index: idx, animated: true }), 100);
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
        <View style={styles.jumpRow}>
          <TouchableOpacity style={styles.jumpBtn} onPress={jumpToTop}>
            <Text style={styles.jumpText}>↑ latest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.jumpBtn, !bookmarkId && styles.jumpDisabled]}
            onPress={jumpToBookmark}
            disabled={!bookmarkId}
          >
            <Text style={styles.jumpText}>🔖 go to bookmark</Text>
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
          ref={listRef}
          onScrollToIndexFailed={info => {
            // rows are variable height: jump near it, then retry once it's laid out
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
            setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: true }), 150);
          }}
          data={all.slice(0, visibleCount)}
          keyExtractor={e => e.id}
          renderItem={({ item }) => (
            <QuestionCard
              entry={item}
              isMine={watched.some(wq => matchesEntry(wq, item))}
              bookmarked={item.id === bookmarkId}
              onToggleBookmark={() => toggleBookmark(item.id)}
            />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            visibleCount < all.length || loadingArchive || archiveCursor !== undefined
              ? <ActivityIndicator style={styles.footer} color="#00FF00" />
              : <Text style={styles.endText}>that's every question ever ({all.length})</Text>
          }
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
  jumpRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  jumpBtn: { borderRadius: 8, borderWidth: 1, borderColor: '#E9EC54', paddingHorizontal: 12, paddingVertical: 6 },
  jumpDisabled: { opacity: 0.35 },
  jumpText: { color: '#E9EC54', fontSize: 12, fontWeight: '700' },
  footer: { marginVertical: 16 },
  endText: { color: '#888', textAlign: 'center', fontSize: 12, marginVertical: 16 },
  loader: { marginTop: 80 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, color: '#ccc', textAlign: 'center', marginBottom: 10, fontWeight: '600' },
  emptySub: { fontSize: 13, color: '#999', textAlign: 'center', lineHeight: 20 },
  list: { padding: 12, paddingTop: 14 },
});
