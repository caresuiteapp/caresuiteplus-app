import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  formatWfmStatusLabel,
  getWfmTodayStatus,
  resetWfmDemoStore,
  wfmClockIn,
  wfmClockOut,
  wfmPause,
  wfmResume,
  wfmSwitchWorkType,
} from '@/lib/wfm';
import { WFM_WORK_TYPES, listWfmWorkTypesForClockIn } from '@/lib/wfm/wfmWorkTypes';

const TENANT = DEMO_TENANT_ID;
const USER = 'user-wfm-test';
const ROLE = 'business_admin' as const;

beforeEach(() => {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  resetWfmDemoStore();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('wfmClockService', () => {
  it('liefert Standard-Tätigkeiten für die Auswahl', () => {
    const types = listWfmWorkTypesForClockIn();
    expect(types.length).toBeGreaterThanOrEqual(5);
    expect(types.map((t) => t.label)).toContain('Büro');
    expect(types.map((t) => t.label)).toContain('Home Office');
    expect(types.map((t) => t.label)).toContain('Einsatz');
    expect(WFM_WORK_TYPES.map((t) => t.label)).toContain('Pause');
  });

  it('startet Arbeitstag und schreibt Session + Event', async () => {
    const result = await wfmClockIn(TENANT, USER, ROLE, 'buero', { source: 'office' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.session?.status).toBe('office');
    expect(result.data.blockCount).toBe(1);
    expect(result.data.statusLabel).toBe('Büro');
  });

  it('verweigert parallelen Start', async () => {
    await wfmClockIn(TENANT, USER, ROLE, 'buero');
    const second = await wfmClockIn(TENANT, USER, ROLE, 'homeoffice');
    expect(second.ok).toBe(false);
  });

  it('pausiert und setzt fort', async () => {
    await wfmClockIn(TENANT, USER, ROLE, 'buero');
    const paused = await wfmPause(TENANT, USER, ROLE);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(paused.data.statusLabel).toBe('Pause');

    const resumed = await wfmResume(TENANT, USER, ROLE);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.data.session?.status).not.toBe('paused');
  });

  it('wechselt Tätigkeit und erhöht Blockanzahl', async () => {
    await wfmClockIn(TENANT, USER, ROLE, 'buero');
    const switched = await wfmSwitchWorkType(TENANT, USER, ROLE, 'homeoffice');
    expect(switched.ok).toBe(true);
    if (!switched.ok) return;
    expect(switched.data.blockCount).toBe(2);
    expect(switched.data.statusLabel).toBe('Home Office');
  });

  it('schließt Arbeitstag ab', async () => {
    await wfmClockIn(TENANT, USER, ROLE, 'buero');
    const closed = await wfmClockOut(TENANT, USER, ROLE);
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.data.session?.status).toBe('ended');
    expect(formatWfmStatusLabel(closed.data.session)).toBe('Feierabend');
  });

  it('liest heutigen Status aus Demo-Store', async () => {
    const empty = await getWfmTodayStatus(TENANT, USER, ROLE);
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.data.statusLabel).toBe('Nicht gestartet');
    expect(empty.data.blockCount).toBe(0);

    await wfmClockIn(TENANT, USER, ROLE, 'einsatz');
    const active = await getWfmTodayStatus(TENANT, USER, ROLE);
    expect(active.ok).toBe(true);
    if (!active.ok) return;
    expect(active.data.statusLabel).toBe('Im Einsatz');
    expect(active.data.blockCount).toBe(1);
  });
});
