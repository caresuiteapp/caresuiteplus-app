import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { exportWfmSessionsCsv, exportWfmSessionsDatev } from '@/lib/wfm/wfmExportService';
import { resetWfmDemoStore, wfmClockIn, wfmClockOut } from '@/lib/wfm';

const TENANT = DEMO_TENANT_ID;
const USER = 'user-export-test';
const ROLE = 'business_admin' as const;

beforeEach(async () => {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  resetWfmDemoStore();
  await wfmClockIn(TENANT, USER, ROLE, 'buero');
  await wfmClockOut(TENANT, USER, ROLE);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('wfmExportService', () => {
  it('erzeugt CSV mit Kopfzeile', async () => {
    const now = new Date();
    const result = await exportWfmSessionsCsv(TENANT, ROLE, now.getFullYear(), now.getMonth() + 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.csv.startsWith('Datum;Mitarbeiter-ID')).toBe(true);
    expect(result.data.rowCount).toBeGreaterThanOrEqual(0);
    expect(result.data.checksum.length).toBeGreaterThan(0);
  });

  it('erzeugt DATEV-Export mit EXTF-Kopf', async () => {
    const now = new Date();
    const result = await exportWfmSessionsDatev(TENANT, ROLE, now.getFullYear(), now.getMonth() + 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.datev.includes('EXTF')).toBe(true);
    expect(result.data.datev.includes('LOHN')).toBe(true);
  });
});
