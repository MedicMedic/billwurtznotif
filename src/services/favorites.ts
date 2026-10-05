import { useEffect, useState } from 'react';
import { QAEntry } from '../types';
import { getFavorites, saveFavorites } from './storage';

// Module-level store so every mounted screen/card sees star changes at once.
let favorites: QAEntry[] = [];
let loaded = false;
const listeners = new Set<(f: QAEntry[]) => void>();

function emit() {
  listeners.forEach(l => l(favorites));
}

async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  const stored = await getFavorites();
  // keep anything starred while the load was in flight
  favorites = [...favorites, ...stored.filter(s => !favorites.some(f => f.id === s.id))];
  emit();
}

export function toggleFavorite(entry: QAEntry): void {
  favorites = favorites.some(f => f.id === entry.id)
    ? favorites.filter(f => f.id !== entry.id)
    : [{ ...entry, detectedAt: undefined }, ...favorites];
  emit();
  saveFavorites(favorites).catch(console.warn);
}

export function useFavorites(): QAEntry[] {
  const [list, setList] = useState(favorites);
  useEffect(() => {
    listeners.add(setList);
    ensureLoaded();
    setList(favorites);
    return () => { listeners.delete(setList); };
  }, []);
  return list;
}
