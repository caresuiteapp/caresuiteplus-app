import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TenantSearchHistoryEntry } from './tenantSearchTypes';

export const TENANT_SEARCH_HISTORY_STORAGE_PREFIX = 'caresuite:tenant-search-history:';
export const TENANT_SEARCH_HISTORY_MAX_ENTRIES = 50;

export function buildTenantSearchHistoryStorageKey(tenantId: string): string {
  return `${TENANT_SEARCH_HISTORY_STORAGE_PREFIX}${tenantId}`;
}

export function pushSearchHistoryEntry(
  entries: TenantSearchHistoryEntry[],
  query: string,
  maxEntries = TENANT_SEARCH_HISTORY_MAX_ENTRIES,
): TenantSearchHistoryEntry[] {
  const trimmed = query.trim();
  if (!trimmed) return entries;

  const normalized = trimmed.toLowerCase();
  const withoutDuplicate = entries.filter((entry) => entry.query.toLowerCase() !== normalized);
  const next: TenantSearchHistoryEntry[] = [
    { query: trimmed, searchedAt: new Date().toISOString() },
    ...withoutDuplicate,
  ];
  return next.slice(0, maxEntries);
}

export function parseSearchHistoryPayload(raw: string | null): TenantSearchHistoryEntry[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is TenantSearchHistoryEntry =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as TenantSearchHistoryEntry).query === 'string' &&
          typeof (entry as TenantSearchHistoryEntry).searchedAt === 'string',
      )
      .slice(0, TENANT_SEARCH_HISTORY_MAX_ENTRIES);
  } catch {
    return [];
  }
}

export async function loadTenantSearchHistory(tenantId: string): Promise<TenantSearchHistoryEntry[]> {
  if (!tenantId.trim()) return [];
  const raw = await AsyncStorage.getItem(buildTenantSearchHistoryStorageKey(tenantId));
  return parseSearchHistoryPayload(raw);
}

export async function saveTenantSearchHistory(
  tenantId: string,
  entries: TenantSearchHistoryEntry[],
): Promise<TenantSearchHistoryEntry[]> {
  if (!tenantId.trim()) return entries;
  await AsyncStorage.setItem(
    buildTenantSearchHistoryStorageKey(tenantId),
    JSON.stringify(entries.slice(0, TENANT_SEARCH_HISTORY_MAX_ENTRIES)),
  );
  return entries;
}

export async function appendTenantSearchHistory(
  tenantId: string,
  query: string,
): Promise<TenantSearchHistoryEntry[]> {
  const current = await loadTenantSearchHistory(tenantId);
  const next = pushSearchHistoryEntry(current, query);
  await saveTenantSearchHistory(tenantId, next);
  return next;
}

export async function clearTenantSearchHistory(tenantId: string): Promise<void> {
  if (!tenantId.trim()) return;
  await AsyncStorage.removeItem(buildTenantSearchHistoryStorageKey(tenantId));
}
