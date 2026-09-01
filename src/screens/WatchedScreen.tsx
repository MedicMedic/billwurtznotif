import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { WatchedQuestion } from '../types';
import { getWatched, saveWatched, getAllEntries } from '../services/storage';
import { askQuestion } from '../services/scraper';
import { matchesEntry } from '../services/matching';
import RichText from '../components/RichText';

export default function WatchedScreen() {
  const [watched, setWatched] = useState<WatchedQuestion[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const items = await getWatched();
    // newest first
    items.sort((a, b) => b.addedAt - a.addedAt);
    setWatched(items);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Random suffix guards against id collisions from rapid taps landing in the same millisecond.
  const buildItem = async (text: string): Promise<WatchedQuestion> => {
    const item: WatchedQuestion = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      // Commas still work as "all keywords must match"; a plain pasted question
      // is matched as a whole by the matcher, so keywords are just a fallback.
      keywords: text.split(',').map(k => k.trim()).filter(k => k.length > 1),
      addedAt: Date.now(),
      matched: false,
    };
    // "already asked" questions may already be answered on the site — check
    // what's already stored instead of only waiting for future new entries
    // (backgroundFetch's matching only ever looks at newly-discovered ones).
    const entries = await getAllEntries();
    const match = entries.find(e => matchesEntry(item, e));
    if (match) {
      item.matched = true;
      item.matchedEntry = match;
    }
    return item;
  };

  const addToWatched = async (text: string) => {
    const item = await buildItem(text);
    const updated = [item, ...watched];
    setWatched(updated);
    await saveWatched(updated);
    setInputText('');
  };

  const watchOnly = async () => {
    const text = inputText.trim();
    if (!text) return;
    setNotice(null);
    await addToWatched(text);
    setNotice('watching — you\'ll get a notification when it\'s answered');
  };

  const askBill = () => {
    const text = inputText.trim();
    if (!text) return;
    Alert.alert(
      'send to billwurtz.com?',
      `"${text.length > 120 ? text.slice(0, 120) + '…' : text}"`,
      [
        { text: 'cancel', style: 'cancel' },
        {
          text: 'send it',
          onPress: async () => {
            setSending(true);
            setNotice(null);
            try {
              await askQuestion(text);
              await addToWatched(text);
              setNotice('sent! now watching for bill\'s answer');
            } catch (err: any) {
              setNotice(`couldn't send (${err?.message || 'network error'}) — try again`);
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  const remove = (id: string) => {
    Alert.alert('Remove question', 'Stop watching this?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const updated = watched.filter(w => w.id !== id);
          setWatched(updated);
          await saveWatched(updated);
        },
      },
    ]);
  };

  const resetMatch = async (id: string) => {
    const updated = watched.map(w =>
      w.id === id ? { ...w, matched: false, matchedEntry: undefined } : w
    );
    setWatched(updated);
    await saveWatched(updated);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.title}>my questions</Text>
        <Text style={styles.subtitle}>
          ask bill a question right from here, or paste one you already asked —
          you'll be notified the moment it's answered.
        </Text>
      </View>

      <View style={styles.inputSection}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="type your question, or paste one you already asked"
          placeholderTextColor="#bbb"
          multiline
          editable={!sending}
        />
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.askBtn, (!inputText.trim() || sending) && styles.btnDisabled]}
            onPress={askBill}
            disabled={!inputText.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={styles.askBtnText}>ask bill</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.watchBtn, (!inputText.trim() || sending) && styles.btnDisabled]}
            onPress={watchOnly}
            disabled={!inputText.trim() || sending}
          >
            <Text style={styles.watchBtnText}>already asked — just watch</Text>
          </TouchableOpacity>
        </View>
        {!!notice && <Text style={styles.notice}>{notice}</Text>}
      </View>

      {watched.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>no questions being watched</Text>
          <Text style={styles.emptySub}>ask or paste a question above</Text>
        </View>
      ) : (
        <FlatList
          data={watched}
          keyExtractor={w => w.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.card, item.matched && styles.cardMatched]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardText}>{item.text}</Text>
                {item.matched && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>ANSWERED</Text>
                  </View>
                )}
              </View>

              {item.matched && item.matchedEntry && (
                <View style={styles.matchBox}>
                  <Text style={styles.matchQ} numberOfLines={2}>
                    Q: <RichText
                      text={item.matchedEntry.question}
                      style={styles.matchQ}
                      linkStyle={styles.matchLink}
                      emptyText="(no question text)"
                    />
                  </Text>
                  <Text style={styles.matchA} numberOfLines={4}>
                    A: <RichText
                      text={item.matchedEntry.answer}
                      style={styles.matchA}
                      linkStyle={styles.matchLink}
                      emptyText="not answered yet"
                    />
                  </Text>
                </View>
              )}

              <View style={styles.actions}>
                {item.matched && (
                  <TouchableOpacity style={styles.resetBtn} onPress={() => resetMatch(item.id)}>
                    <Text style={styles.resetText}>watch again</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.removeBtn} onPress={() => remove(item.id)}>
                  <Text style={styles.removeText}>remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#323232' },
  header: { padding: 16, paddingTop: 20, backgroundColor: '#232323' },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#999', lineHeight: 19 },
  inputSection: { padding: 12, paddingBottom: 10, backgroundColor: '#3a3a3a', borderBottomWidth: 1, borderColor: '#000' },
  input: {
    borderWidth: 1.5, borderColor: '#555',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#fff', backgroundColor: '#2a2a2a',
    minHeight: 64, maxHeight: 140, textAlignVertical: 'top',
    marginBottom: 8,
  },
  btnRow: { flexDirection: 'row', gap: 8 },
  askBtn: {
    backgroundColor: '#B387FF', borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center', minWidth: 90,
  },
  askBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  watchBtn: {
    flex: 1, backgroundColor: '#000', borderRadius: 10,
    borderWidth: 1, borderColor: '#00EE3B',
    paddingHorizontal: 12, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  watchBtnText: { color: '#00FF00', fontWeight: '600', fontSize: 13 },
  btnDisabled: { opacity: 0.4 },
  notice: { fontSize: 12, color: '#b3ffb3', marginTop: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, color: '#ccc', textAlign: 'center', marginBottom: 8, fontWeight: '600' },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center' },
  list: { padding: 12, paddingTop: 14 },
  card: {
    backgroundColor: '#444', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#000',
    elevation: 2,
  },
  cardMatched: { borderColor: '#00EE3B', borderWidth: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#B387FF', marginRight: 8 },
  badge: { backgroundColor: '#00EE3B', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { color: '#000', fontSize: 10, fontWeight: '800' },
  matchBox: {
    backgroundColor: '#333', borderRadius: 8, padding: 10, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: '#00EE3B',
  },
  matchQ: { fontSize: 13, color: '#B387FF', marginBottom: 4, fontStyle: 'italic' },
  matchA: { fontSize: 13, color: '#fff', lineHeight: 19 },
  matchLink: { color: '#00EE3B', textDecorationLine: 'underline' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  resetBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#00EE3B' },
  resetText: { color: '#00FF00', fontSize: 12, fontWeight: '600' },
  removeBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#ff6666' },
  removeText: { color: '#ff6666', fontSize: 12, fontWeight: '600' },
});
