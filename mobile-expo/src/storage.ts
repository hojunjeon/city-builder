import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CityLayoutSnapshot } from './types';

const STORAGE_KEY = 'spend-city-builder-v3-dynamic-terrain';

export async function saveCityLayout(snapshot: CityLayoutSnapshot): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export async function loadCityLayout(): Promise<CityLayoutSnapshot | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') return null;

  const candidate = parsed as Partial<CityLayoutSnapshot>;
  if (!Array.isArray(candidate.items)) return null;

  return {
    version: 3,
    items: candidate.items,
    showGrid: candidate.showGrid !== false,
    showReference: Boolean(candidate.showReference),
    savedAt:
      typeof candidate.savedAt === 'string'
        ? candidate.savedAt
        : new Date().toISOString(),
  };
}

export async function clearCityLayout(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
