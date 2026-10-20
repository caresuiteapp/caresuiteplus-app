import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  mapAssistEventToWfm,
  resetWfmAssistAdapterState,
  syncAssistTimeEventToWfm,
} from '@/lib/wfm/wfmAssistAdapter';
import { resetWfmDemoStore, getWfmTodayStatus } from '@/lib/wfm';

const TENANT = DEMO_TENANT_ID;
const USER = 'user-assist-sync';
const EMPLOYEE = `demo-employee-${USER}`;

beforeEach(() => {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  resetWfmDemoStore();
  resetWfmAssistAdapterState();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('wfmAssistAdapter', () => {
  it('mappt Assist-Events auf WFM-Typen', () => {
    expect(mapAssistEventToWfm('service_start')).toBe('visit_started');
    expect(mapAssistEventToWfm('drive_start')).toBe('visit_drive_start');
    expect(mapAssistEventToWfm('pause_start')).toBe('pause_start');
  });

  it('schreibt Einsatzstart in WFM-Session', async () => {
    const result = await syncAssistTimeEventToWfm(
      TENANT,
      EMPLOYEE,
      USER,
      'visit-123',
      'service_start',
    );
    expect(result.ok).toBe(true);

    const status = await getWfmTodayStatus(TENANT, USER, 'employee_portal');
    expect(status.ok).toBe(true);
    if (!status.ok) return;
    expect(status.data.statusLabel).toBe('Im Einsatz');
    expect(status.data.blockCount).toBe(1);
  });
});
