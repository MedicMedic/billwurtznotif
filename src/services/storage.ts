import AsyncStorage from '@react-native-async-storage/async-storage';
import { QAEntry, WatchedQuestion } from '../types';

const K = {
  SEEN_IDS: '@bw_seen_ids',
  WATCHED: '@bw_watched',
  NEW_ENTRIES: '@bw_new_entries',
  ALL_ENTRIES: '@bw_all_entries',
  LAST_CHECK: '@bw_last_check',
  INITIALIZED: '@bw_initialized',
};

// Full snapshot of the current site content, for the feed to scroll through.
export async function getAllEntries(): Promise<QAEntry[]> {
  const raw = await AsyncStorage.getItem(K.ALL_ENTRIES);
  return raw ? JSON.parse(raw) : [];
}

export async function saveAllEntries(entries: QAEntry[]): Promise<void> {
  await AsyncStorage.setItem(K.ALL_ENTRIES, JSON.stringify(entries.slice(0, 300)));
}

export async function getSeenIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(K.SEEN_IDS);
  return new Set<string>(raw ? JSON.parse(raw) : []);
}

export async function addSeenIds(ids: string[]): Promise<void> {
  const seen = await getSeenIds();
  ids.forEach(id => seen.add(id));
  await AsyncStorage.setItem(K.SEEN_IDS, JSON.stringify([...seen]));
}

export async function isInitialized(): Promise<boolean> {
  return !!(await AsyncStorage.getItem(K.INITIALIZED));
}

export async function markInitialized(): Promise<void> {
  await AsyncStorage.setItem(K.INITIALIZED, '1');
}

export async function getWatched(): Promise<WatchedQuestion[]> {
  const raw = await AsyncStorage.getItem(K.WATCHED);
  return raw ? JSON.parse(raw) : [];
}

export async function saveWatched(items: WatchedQuestion[]): Promise<void> {
  await AsyncStorage.setItem(K.WATCHED, JSON.stringify(items));
}

export async function getNewEntries(): Promise<QAEntry[]> {
  const raw = await AsyncStorage.getItem(K.NEW_ENTRIES);
  return raw ? JSON.parse(raw) : [];
}

export async function prependNewEntries(entries: QAEntry[]): Promise<void> {
  const existing = await getNewEntries();
  const merged = [...entries, ...existing].slice(0, 100);
  await AsyncStorage.setItem(K.NEW_ENTRIES, JSON.stringify(merged));
}

export async function getLastCheck(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(K.LAST_CHECK);
  return raw ? parseInt(raw, 10) : null;
}

export async function setLastCheck(time: number): Promise<void> {
  await AsyncStorage.setItem(K.LAST_CHECK, time.toString());
}
