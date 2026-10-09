import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useFavorites } from '../services/favorites';
import QuestionCard from '../components/QuestionCard';

export default function StarredScreen() {
  const favorites = useFavorites();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>starred</Text>
        <Text style={styles.subtitle}>your starred questions. tap the star on any card to add it.</Text>
      </View>
      {favorites.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>nothing starred yet</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={e => e.id}
          renderItem={({ item }) => <QuestionCard entry={item} />}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#323232' },
  header: { padding: 16, paddingTop: 20, backgroundColor: '#232323' },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#999', lineHeight: 19 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, color: '#ccc', textAlign: 'center', fontWeight: '600' },
  list: { padding: 12, paddingTop: 14 },
});
