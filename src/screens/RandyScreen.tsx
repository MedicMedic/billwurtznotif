import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl,
} from 'react-native';
import { QAEntry } from '../types';
import { fetchRandom } from '../services/scraper';
import QuestionCard from '../components/QuestionCard';

export default function RandyScreen() {
  const [entry, setEntry] = useState<QAEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntry(await fetchRandom());
    } catch (err: any) {
      setError(err?.message || "couldn't fetch a question");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { roll(); }, [roll]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>i'm feeling randy</Text>
        <Text style={styles.subtitle}>random ue<Text style={{ color: '#00FF00' }}>q</Text>stions from the archive. pull down or tap the button for another.</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading && !!entry} onRefresh={roll} />}
      >
        {!!error && <Text style={styles.error}>{error}</Text>}
        {entry
          ? <QuestionCard entry={entry} />
          : loading && <ActivityIndicator style={styles.loader} size="large" color="#00FF00" />}
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnBusy]}
          onPress={roll}
          disabled={loading}
        >
          <Text style={styles.btnText}>i'm feeling randy</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#323232' },
  header: { padding: 16, paddingTop: 20, backgroundColor: '#232323' },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#999', lineHeight: 19 },
  list: { padding: 12, paddingTop: 14 },
  loader: { marginVertical: 40 },
  error: { color: '#ff6666', marginBottom: 10, fontSize: 13 },
  btn: {
    backgroundColor: '#000', borderRadius: 8, borderWidth: 1, borderColor: '#ff4444',
    paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  btnBusy: { opacity: 0.5 },
  btnText: { color: '#ff4444', fontWeight: '700', fontSize: 14 },
});
