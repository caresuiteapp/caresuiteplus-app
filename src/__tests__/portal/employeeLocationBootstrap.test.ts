import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ permission: vi.fn(), employee: vi.fn(), visit: vi.fn(), apply: vi.fn() }));
vi.mock('@/features/liveTracking/employeeLocationConsentPersistence', () => ({ fetchEmployeeLocationConsentRecord: mocks.employee }));
vi.mock('@/features/liveTracking/getEmployeeLocationConsent', () => ({ getEmployeeLocationConsent: mocks.visit }));
vi.mock('@/lib/portal/employeePortalVisitTrackingService', () => ({ getEmployeePortalGpsPermissionStatus: mocks.permission, getEmployeePortalLocationConsent: () => ({ granted: false, grantedAt: null, explainedAt: null }), applyEmployeePortalLocationConsent: mocks.apply }));
import { hydrateEmployeePortalLocationState, LOCATION_CONSENT_READ_WARNING } from '@/lib/portal/hydrateEmployeePortalLocationState';
const consent = { granted: true, grantedAt: '2026-10-26T14:00:00Z', explainedAt: '2026-10-26T13:59:00Z' };
const options = () => ({ tenantId: 'tenant-a', employeeId: 'employee-a', assignmentId: 'visit-a', authProfileId: 'profile-a', isCurrent: vi.fn(() => true), onConsent: vi.fn(), onPermission: vi.fn(), onWarning: vi.fn() });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
describe('employee execution location startup', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.permission.mockResolvedValue('granted'); mocks.employee.mockResolvedValue({ ok: true, data: null }); mocks.visit.mockResolvedValue({ ok: true, data: { granted: false, grantedAt: null, explainedAt: null } }); });
  it('keeps rejected native permissions recoverable and reads consent independently', async () => {
    mocks.permission.mockRejectedValue(new Error('Native module unavailable')); mocks.employee.mockResolvedValue({ ok: true, data: consent });
    const callbacks = options(); await expect(hydrateEmployeePortalLocationState(callbacks)).resolves.toBeUndefined();
    expect(callbacks.onPermission).toHaveBeenCalledWith('unavailable'); expect(callbacks.onConsent).toHaveBeenCalledWith(consent);
    expect(mocks.visit).not.toHaveBeenCalled(); expect(mocks.apply).toHaveBeenCalledWith('tenant-a', 'visit-a', consent);
  });
  it.each(['sync', 'async'])('reports a %s consent read failure without granting tracking', async (kind) => {
    if (kind === 'sync') mocks.employee.mockImplementation(() => { throw new Error('Transport failed'); }); else mocks.employee.mockRejectedValue(new Error('Transport failed'));
    const callbacks = options(); await expect(hydrateEmployeePortalLocationState(callbacks)).resolves.toBeUndefined();
    expect(callbacks.onPermission).toHaveBeenCalledWith('granted'); expect(callbacks.onWarning).toHaveBeenCalledWith(LOCATION_CONSENT_READ_WARNING);
    expect(callbacks.onConsent).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled();
  });
  it('hydrates confirmed visit consent with its exact employee and tenant scope', async () => {
    mocks.visit.mockResolvedValue({ ok: true, data: consent }); const callbacks = options(); await hydrateEmployeePortalLocationState(callbacks);
    expect(mocks.visit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a', employeeId: 'employee-a', routeParamId: 'visit-a', portalAccountId: 'profile-a' }));
    expect(callbacks.onConsent).toHaveBeenCalledWith(consent);
  });
  it('ignores late results after the visit or account changes', async () => {
    const permission = deferred<string>(), employee = deferred<{ ok: true; data: typeof consent }>();
    mocks.permission.mockReturnValue(permission.promise); mocks.employee.mockReturnValue(employee.promise);
    const callbacks = options(), run = hydrateEmployeePortalLocationState(callbacks); callbacks.isCurrent.mockReturnValue(false);
    permission.resolve('granted'); employee.resolve({ ok: true, data: consent }); await run;
    expect(callbacks.onPermission).not.toHaveBeenCalled(); expect(callbacks.onConsent).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled(); expect(mocks.visit).not.toHaveBeenCalled();
  });
  it('rechecks the scope after the visit-level fallback finishes', async () => {
    const visit = deferred<{ ok: true; data: typeof consent }>(); mocks.visit.mockReturnValue(visit.promise);
    const callbacks = options(), run = hydrateEmployeePortalLocationState(callbacks);
    await vi.waitFor(() => expect(mocks.visit).toHaveBeenCalled()); callbacks.isCurrent.mockReturnValue(false); visit.resolve({ ok: true, data: consent }); await run;
    expect(callbacks.onConsent).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled();
  });
  it('keeps a failed fallback visible and grants no consent', async () => {
    mocks.visit.mockResolvedValue({ ok: false, error: 'No connection' }); const callbacks = options(); await hydrateEmployeePortalLocationState(callbacks);
    expect(callbacks.onWarning).toHaveBeenCalledWith(LOCATION_CONSENT_READ_WARNING); expect(callbacks.onConsent).not.toHaveBeenCalled();
  });
});
