// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WfmWorkSession } from '@/types/modules/wfm';

const state = vi.hoisted(() => ({ employeeId: 'employee-a' as string | null, resolvedEmployeeId: 'employee-a' as string | null, tenantId: 'tenant-a', permissions: [] as string[], identity: vi.fn(), status: vi.fn(), settings: vi.fn(), warnings: vi.fn(), clockIn: vi.fn(), clockOut: vi.fn(), checkIn: vi.fn(), pause: vi.fn(), resume: vi.fn(), switch: vi.fn(), push: vi.fn() }));
vi.mock('expo-router', () => ({ useIsFocused: () => true, useRouter: () => ({ push: state.push }) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ user: { id: 'user-a' }, profile: { employeeId: state.employeeId } }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => state.tenantId }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ roleKey: 'business_admin', permissions: state.permissions, can: (key: string) => state.permissions.includes(key), check: () => ({ reason: 'Keine Berechtigung.' }) }) }));
vi.mock('@/components/wfm/WfmSecondaryWorkspace.web', () => ({ WfmSecondaryWorkspace: ({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) => <div>{actions}{children}</div>, WfmWebNotice: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, useWfmUnsavedChanges: () => undefined }));
vi.mock('@/lib/timeTracking/timeTrackingSettingsService', () => ({ fetchPortalTimeTrackingSettings: (...args: unknown[]) => state.settings(...args) }));
vi.mock('@/lib/wfm/wfmCheckinService', () => ({ wfmOfficeCheckInByToken: (...args: unknown[]) => state.checkIn(...args) }));
vi.mock('@/lib/wfm/wfmRuleEngine', () => ({ listWfmRuleViolationsForDate: (...args: unknown[]) => state.warnings(...args) }));
vi.mock('@/lib/wfm/wfmWorkSessionRepository', () => ({ todayWorkDate: () => '2026-10-18' }));
vi.mock('@/lib/wfm/wfmOfficeOwnIdentity.web', () => ({ resolveOfficeOwnIdentity: (...args: unknown[]) => state.identity(...args) }));
vi.mock('@/lib/wfm', () => ({
  getWfmTodayStatus: (...args: unknown[]) => state.status(...args), listWfmWorkTypesForClockIn: () => [{ key: 'buero', label: 'Büro' }],
  isWfmSessionActive: (session: WfmWorkSession | null) => !!session && session.status !== 'ended', isWfmSessionPaused: (session: WfmWorkSession | null) => session?.status === 'paused',
  wfmClockIn: (...args: unknown[]) => state.clockIn(...args), wfmClockOut: (...args: unknown[]) => state.clockOut(...args), wfmPause: (...args: unknown[]) => state.pause(...args), wfmResume: (...args: unknown[]) => state.resume(...args), wfmSwitchWorkType: (...args: unknown[]) => state.switch(...args),
}));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/lib/services/queryTimeout', () => ({ NATIVE_SERVICE_QUERY_TIMEOUT_MS: 30000, withServiceQueryTimeout: (promise: Promise<unknown>) => promise }));
import { WfmOwnTimeTrackingScreen } from '@/components/wfm/WfmOwnTimeTrackingScreen.web';

const permissions = ['time.tracking.own.view', 'time.tracking.own.start', 'time.tracking.own.pause', 'time.tracking.own.resume', 'time.tracking.own.switch', 'time.tracking.own.close'];
const ok = <T,>(data: T) => ({ ok: true as const, data });
const day = (session: Partial<WfmWorkSession> | null = null) => ({ session, events: [], statusLabel: session ? 'Büro' : 'Nicht gestartet', blockCount: session ? 2 : 0 });
let host: HTMLDivElement; let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.employeeId = 'employee-a'; state.resolvedEmployeeId = 'employee-a'; state.tenantId = 'tenant-a'; state.permissions = [...permissions];
  state.identity.mockReset().mockImplementation(async () => ok({ employeeId: state.resolvedEmployeeId }));
  state.status.mockReset().mockResolvedValue(ok(day())); state.settings.mockReset().mockResolvedValue(ok({ moduleEnabled: true, requirePrivacyConsent: true })); state.warnings.mockReset().mockResolvedValue(ok([]));
  for (const method of [state.clockIn, state.clockOut, state.checkIn, state.pause, state.resume, state.switch]) method.mockReset().mockResolvedValue(ok({}));
  state.push.mockReset(); vi.spyOn(window, 'confirm').mockReturnValue(true); host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const render = async () => { await act(async () => root.render(<WfmOwnTimeTrackingScreen />)); };
const button = (label: string) => { const result = [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === label); if (!result) throw new Error(`Button fehlt: ${label}`); return result; };
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
async function input(value: string) { const element = host.querySelector<HTMLInputElement>('input:not([type=checkbox])')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); }); }

describe('Office own worktime controls', () => {
  it('uses the same persisted consent gate for a normal start and the office code', async () => {
    await render(); await input('ABCDEFGH');
    expect(button('Arbeitstag starten').disabled).toBe(true); expect(button('Im Büro einchecken').disabled).toBe(true);
    await click(host.querySelector<HTMLInputElement>('input[type=checkbox]')!);
    expect(button('Arbeitstag starten').disabled).toBe(false); expect(button('Im Büro einchecken').disabled).toBe(false);
    await click(button('Im Büro einchecken'));
    expect(state.checkIn).toHaveBeenCalledExactlyOnceWith('tenant-a', 'user-a', 'business_admin', 'ABCDEFGH', { employeeId: 'employee-a' });
    expect(state.clockIn).not.toHaveBeenCalled();
  });
  it('starts only the authenticated employee and blocks duplicate clicks while saving', async () => {
    state.settings.mockResolvedValue(ok({ moduleEnabled: true, requirePrivacyConsent: false }));
    let finish!: (value: ReturnType<typeof ok>) => void; state.clockIn.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await render(); await click(button('Arbeitstag starten')); await click(button('Arbeitstag starten'));
    expect(state.clockIn).toHaveBeenCalledExactlyOnceWith('tenant-a', 'user-a', 'business_admin', 'buero', { employeeId: 'employee-a', source: 'office' });
    await act(async () => finish(ok({}))); expect(host.textContent).toContain('Arbeitstag gestartet.');
  });
  it('allows finishing an active workday after starts are disabled, with exact minute display', async () => {
    state.status.mockResolvedValue(ok(day({ status: 'office', netMinutes: 97, pauseMinutes: 13 })));
    state.settings.mockResolvedValue(ok({ moduleEnabled: false, requirePrivacyConsent: true }));
    await render(); expect(host.textContent).toContain('1 Std. 37 Min.'); expect(host.textContent).toContain('0 Std. 13 Min.'); expect(button('Feierabend').disabled).toBe(false);
    await click(button('Feierabend')); expect(state.clockOut).toHaveBeenCalledExactlyOnceWith('tenant-a', 'user-a', 'business_admin', { employeeId: 'employee-a', source: 'office' });
  });
  it('resolves the signed-in business employee even when profile.employeeId is absent', async () => {
    state.employeeId = null; await render(); expect(state.status).toHaveBeenCalledWith('tenant-a', 'user-a', 'business_admin', { employeeId: 'employee-a', source: 'office' }); expect(host.textContent).not.toContain('Mitarbeiterzuordnung prüfen');
  });
  it('does not offer mutation rights merely because an active session is visible', async () => {
    state.permissions = ['time.tracking.own.view']; state.status.mockResolvedValue(ok(day({ status: 'office', netMinutes: 60, pauseMinutes: 0 })));
    await render(); expect(button('Feierabend').disabled).toBe(true); expect(button('Pause beginnen').disabled).toBe(true); expect(button('Tätigkeit übernehmen').disabled).toBe(true);
  });
  it('does not load or stamp without a linked employee or view permission', async () => {
    state.employeeId = null; state.resolvedEmployeeId = null; await render(); expect(host.textContent).toContain('Keine persönliche Zeiterfassung eingerichtet'); expect(host.textContent).not.toContain('RLS'); expect(state.status).not.toHaveBeenCalled();
    state.employeeId = 'employee-a'; state.permissions = []; await render(); expect(state.status).not.toHaveBeenCalled(); expect(state.clockIn).not.toHaveBeenCalled();
  });
  it('uses only the server-confirmed employee when a cached profile link disagrees', async () => {
    state.employeeId = 'stale-or-foreign-employee'; await render();
    expect(state.status).toHaveBeenCalledWith('tenant-a', 'user-a', 'business_admin', { employeeId: 'employee-a', source: 'office' });
    expect(state.identity).toHaveBeenCalledWith({ tenantId: 'tenant-a', userId: 'user-a', roleKey: 'business_admin', effectivePermissions: permissions });
  });
  it('keeps real identity failures distinct from an unbound administrator', async () => {
    state.identity.mockResolvedValue({ ok: false, error: 'Zuordnungsabruf abgelehnt' }); await render();
    expect(host.textContent).toContain('Mitarbeiterzuordnung nicht verfügbar'); expect(host.textContent).toContain('Zuordnungsabruf abgelehnt');
    expect(host.textContent).not.toContain('Keine persönliche Zeiterfassung eingerichtet'); expect(state.status).not.toHaveBeenCalled(); expect(state.clockIn).not.toHaveBeenCalled();
  });
  it('discards a late identity response after switching tenant scope', async () => {
    await render(); state.status.mockClear();
    let finish!: (value: { ok: true; data: { employeeId: string } }) => void;
    state.tenantId = 'tenant-b'; state.identity.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await render(); expect(host.textContent).toContain('Mitarbeiterzuordnung wird geprüft'); expect(state.status).not.toHaveBeenCalled();
    state.tenantId = 'tenant-c'; state.identity.mockResolvedValue(ok({ employeeId: 'employee-c' })); await render();
    await act(async () => finish(ok({ employeeId: 'employee-b' })));
    expect(state.status.mock.calls.every(call => call[0] === 'tenant-c' && call[3].employeeId === 'employee-c')).toBe(true);
    expect(state.clockIn).not.toHaveBeenCalled();
  });
  it('blocks start on failed settings and reports failed writes without claiming success', async () => {
    state.settings.mockResolvedValue({ ok: false, error: 'Einstellungen nicht erreichbar' }); await render(); expect(button('Arbeitstag starten').disabled).toBe(true);
    state.settings.mockResolvedValue(ok({ moduleEnabled: true, requirePrivacyConsent: false })); await click(button('Aktualisieren'));
    state.clockIn.mockResolvedValue({ ok: false, error: 'Buchung gesperrt' }); await click(button('Arbeitstag starten'));
    expect(host.textContent).toContain('Buchung gesperrt'); expect(host.textContent).not.toContain('Arbeitstag gestartet.');
  });
});
