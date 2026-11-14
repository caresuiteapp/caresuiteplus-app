import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {stageVitalCaptureClient, takeVitalCaptureClient} from '@/lib/pflege/vitalCaptureHandoff';

const tenantId = '10000000-0000-4000-8000-000000000001';
const profileId = '20000000-0000-4000-8000-000000000002';
const clientId = '30000000-0000-4000-8000-000000000003';
const otherId = '40000000-0000-4000-8000-000000000004';
const scope = {tenantId, profileId, roleKey: 'nurse'};
const start = 1_700_000_000_000;

describe('Weitergabe der Klientenauswahl in die Vitalwerterfassung', () => {
  beforeEach(() => { takeVitalCaptureClient(scope); });
  afterEach(() => { takeVitalCaptureClient(scope); vi.restoreAllMocks(); });

  it('delivers the hint once to the same tenant, person and role just before expiry', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(start);
    stageVitalCaptureClient(scope, clientId);
    clock.mockReturnValue(start + 59_999);
    expect(takeVitalCaptureClient({...scope})).toBe(clientId);
    expect(takeVitalCaptureClient(scope)).toBeNull();
  });

  it.each([
    {...scope, tenantId: otherId},
    {...scope, profileId: otherId},
    {...scope, roleKey: 'business_admin'},
  ])('discards a pending hint on a scope mismatch (%o)', otherScope => {
    stageVitalCaptureClient(scope, clientId);
    expect(takeVitalCaptureClient(otherScope)).toBeNull();
    expect(takeVitalCaptureClient(scope)).toBeNull();
  });

  it.each([60_000, -1])('discards a hint when the clock advances by %i ms', elapsed => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(start);
    stageVitalCaptureClient(scope, clientId);
    clock.mockReturnValue(start + elapsed);
    expect(takeVitalCaptureClient(scope)).toBeNull();
    clock.mockReturnValue(start);
    expect(takeVitalCaptureClient(scope)).toBeNull();
  });

  it.each([
    [{...scope, tenantId: 'tenant'}, clientId],
    [{...scope, profileId: 'profile'}, clientId],
    [{...scope, roleKey: ''}, clientId],
    [scope, 'client'],
  ] as const)('discards malformed input and does not leave a previous hint behind', (invalidScope, invalidClient) => {
    stageVitalCaptureClient(scope, clientId);
    stageVitalCaptureClient(invalidScope, invalidClient);
    expect(takeVitalCaptureClient(scope)).toBeNull();
  });
});
