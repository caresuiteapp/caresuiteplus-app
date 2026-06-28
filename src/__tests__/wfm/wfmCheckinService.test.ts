import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  createWfmCheckinToken,
  resetWfmCheckinDemoStore,
  wfmOfficeCheckInByToken,
  wfmOfficeCheckOut,
} from '@/lib/wfm/wfmCheckinService';
import { resetWfmDemoStore } from '@/lib/wfm';

const TENANT = DEMO_TENANT_ID;
const USER = 'user-checkin-test';
const ROLE = 'business_admin' as const;

beforeEach(() => {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  resetWfmDemoStore();
  resetWfmCheckinDemoStore();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('wfmCheckinService', () => {
  it('erstellt Token und checkt ein', async () => {
    const tokenResult = await createWfmCheckinToken(TENANT, USER, ROLE, {
      locationLabel: 'Empfang',
    });
    expect(tokenResult.ok).toBe(true);
    if (!tokenResult.ok) return;

    const checkIn = await wfmOfficeCheckInByToken(
      TENANT,
      USER,
      ROLE,
      tokenResult.data.tokenCode,
    );
    expect(checkIn.ok).toBe(true);
    if (!checkIn.ok) return;
    expect(checkIn.data.session?.workMode).toBe('office');
    expect(checkIn.data.blockCount).toBeGreaterThanOrEqual(1);
  });

  it('lehnt ungültigen Code ab', async () => {
    const result = await wfmOfficeCheckInByToken(TENANT, USER, ROLE, 'INVALID1');
    expect(result.ok).toBe(false);
  });

  it('check-out nach check-in', async () => {
    const tokenResult = await createWfmCheckinToken(TENANT, USER, ROLE, {
      locationLabel: 'Empfang',
    });
    if (!tokenResult.ok) return;
    await wfmOfficeCheckInByToken(TENANT, USER, ROLE, tokenResult.data.tokenCode);

    const checkOut = await wfmOfficeCheckOut(TENANT, USER, ROLE);
    expect(checkOut.ok).toBe(true);
    if (!checkOut.ok) return;
    expect(checkOut.data.session?.status).toBe('ended');
  });
});
