import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearDashboardTourState,
  isDashboardTourFinished,
  loadDashboardTourState,
  markDashboardTourCompleted,
  markDashboardTourSkipped,
} from '@/lib/onboarding/dashboardTourStorage';
import { DASHBOARD_TOUR_STEPS } from '@/lib/onboarding/dashboardTourSteps';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe('Business-Dashboard Tour', () => {
  const userId = 'user-tour-1';
  const tenantId = 'tenant-tour-1';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue();
    vi.mocked(AsyncStorage.removeItem).mockResolvedValue();
  });

  it('definiert sechs deutsche Tour-Schritte', () => {
    expect(DASHBOARD_TOUR_STEPS).toHaveLength(6);
    expect(DASHBOARD_TOUR_STEPS[0]?.title).toBe('Willkommen in CareSuite+');
    expect(DASHBOARD_TOUR_STEPS.at(-1)?.title).toBe('Erste Klient:in anlegen');
  });

  it('persistiert Abschluss pro Mandant und Benutzer', async () => {
    const state = await markDashboardTourCompleted(userId, tenantId);
    expect(state.completedAt).toBeTruthy();
    expect(isDashboardTourFinished(state)).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      `caresuite:dashboard-tour:${tenantId}:${userId}`,
      expect.stringContaining('completedAt'),
    );
  });

  it('persistiert Überspringen separat', async () => {
    const state = await markDashboardTourSkipped(userId, tenantId);
    expect(state.skippedAt).toBeTruthy();
    expect(isDashboardTourFinished(state)).toBe(true);
  });

  it('lädt gespeicherten Zustand', async () => {
    const stored = {
      completedAt: '2026-06-16T10:00:00.000Z',
      skippedAt: null,
    };
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(stored));
    const loaded = await loadDashboardTourState(userId, tenantId);
    expect(loaded.completedAt).toBe(stored.completedAt);
    expect(isDashboardTourFinished(loaded)).toBe(true);
  });

  it('löscht Tour-Zustand für erneuten Start', async () => {
    await clearDashboardTourState(userId, tenantId);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      `caresuite:dashboard-tour:${tenantId}:${userId}`,
    );
  });
});
