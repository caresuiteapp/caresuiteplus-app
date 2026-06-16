import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'caresuite:dashboard-tour';

export type DashboardTourPersistedState = {
  completedAt: string | null;
  skippedAt: string | null;
};

function storageKey(userId: string, tenantId: string): string {
  return `${STORAGE_PREFIX}:${tenantId}:${userId}`;
}

function emptyState(): DashboardTourPersistedState {
  return { completedAt: null, skippedAt: null };
}

export function isDashboardTourFinished(state: DashboardTourPersistedState): boolean {
  return Boolean(state.completedAt || state.skippedAt);
}

export async function loadDashboardTourState(
  userId: string,
  tenantId: string,
): Promise<DashboardTourPersistedState> {
  const raw = await AsyncStorage.getItem(storageKey(userId, tenantId));
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw) as DashboardTourPersistedState;
    return {
      completedAt: parsed.completedAt ?? null,
      skippedAt: parsed.skippedAt ?? null,
    };
  } catch {
    return emptyState();
  }
}

export async function markDashboardTourCompleted(
  userId: string,
  tenantId: string,
): Promise<DashboardTourPersistedState> {
  const state: DashboardTourPersistedState = {
    completedAt: new Date().toISOString(),
    skippedAt: null,
  };
  await AsyncStorage.setItem(storageKey(userId, tenantId), JSON.stringify(state));
  return state;
}

export async function markDashboardTourSkipped(
  userId: string,
  tenantId: string,
): Promise<DashboardTourPersistedState> {
  const state: DashboardTourPersistedState = {
    completedAt: null,
    skippedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(storageKey(userId, tenantId), JSON.stringify(state));
  return state;
}

export async function clearDashboardTourState(userId: string, tenantId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(userId, tenantId));
}
