import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WfmWorkSession } from '@/types/modules/wfm';
const state = vi.hoisted(() => ({ sessions: vi.fn(), employees: vi.fn() }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: (tenant: string) => tenant ? null : { ok: false, error: 'Mandant fehlt.' } }));
vi.mock('@/lib/wfm/wfmOfficeTimekeepingReads', () => ({ readOfficeSessions: (...args: unknown[]) => state.sessions(...args), readOfficeEmployees: (...args: unknown[]) => state.employees(...args) }));
vi.mock('@/lib/wfm/wfmClockService', () => ({ formatWfmStatusLabel: (session: WfmWorkSession) => session.status === 'ended' ? 'Feierabend' : 'Büro' }));
vi.mock('@/lib/wfm/wfmLiveStatusService', () => ({ getWfmLiveEmployeeOverview: vi.fn() }));
import { readOfficeLivePresence } from '@/lib/wfm/wfmOfficeLivePresence.web';
const input = { tenantId: 'tenant-a', roleKey: 'business_admin' as const, effectivePermissions: ['time.tracking.team.view' as const], now: new Date('2026-10-17T22:05:00Z') };
const session = (changes: Partial<WfmWorkSession> = {}): WfmWorkSession => ({ id: 's', tenantId: 'tenant-a', employeeId: 'e', userId: null, workDate: '2026-10-18', status: 'office', workMode: 'office', displayStatus: 'buero', startedAt: '2026-10-17T22:00:00Z', endedAt: null, lastEventAt: '2026-10-17T22:00:00Z', grossMinutes: 5, netMinutes: 5, pauseMinutes: 0, isOnline: true, ...changes });
beforeEach(() => { state.sessions.mockReset().mockResolvedValue({ ok: true, data: [session()] }); state.employees.mockReset().mockResolvedValue({ ok: true, data: [{ id: 'e', tenant_id: 'tenant-a', first_name: 'Anne', last_name: 'Adler' }] }); });
describe('Strict Web live attendance', () => {
  it('loads the Berlin work day and names through strict readers', async () => {
    const result = await readOfficeLivePresence(input); expect(state.sessions).toHaveBeenCalledExactlyOnceWith('tenant-a', '2026-10-18'); expect(state.employees).toHaveBeenCalledExactlyOnceWith('tenant-a');
    expect(result).toMatchObject({ ok: true, data: { onlineCount: 1, totalCount: 1, rows: [{ employeeName: 'Anne Adler' }] } });
  });
  it('requires current effective permission before any read', async () => {
    expect((await readOfficeLivePresence({ ...input, effectivePermissions: [] })).ok).toBe(false);
    expect((await readOfficeLivePresence({ ...input, roleKey: 'employee_portal' })).ok).toBe(false); expect(state.sessions).not.toHaveBeenCalled(); expect(state.employees).not.toHaveBeenCalled();
  });
  it('does not present failed session or name reads as an empty success', async () => {
    state.sessions.mockResolvedValueOnce({ ok: false, error: 'Tabelle nicht verfügbar.' }); expect(await readOfficeLivePresence(input)).toEqual({ ok: false, error: 'Tabelle nicht verfügbar.' }); expect(state.employees).not.toHaveBeenCalled();
    state.employees.mockResolvedValue({ ok: false, error: 'Personalabfrage fehlgeschlagen.' }); expect(await readOfficeLivePresence(input)).toEqual({ ok: false, error: 'Personalabfrage fehlgeschlagen.' });
  });
  it('rejects sessions from another tenant, date, or invalid stored duration', async () => {
    for (const changes of [{ tenantId: 'other' }, { workDate: '2026-10-17' }, { netMinutes: NaN }, { pauseMinutes: -1 }]) {
      state.sessions.mockResolvedValueOnce({ ok: true, data: [session(changes)] }); expect((await readOfficeLivePresence(input)).ok).toBe(false);
    }
    expect(state.employees).not.toHaveBeenCalled();
  });
  it('does not expose a foreign name or count an ended session as active', async () => {
    state.sessions.mockResolvedValue({ ok: true, data: [session({ status: 'ended', isOnline: true })] }); state.employees.mockResolvedValue({ ok: true, data: [{ id: 'e', tenant_id: 'foreign', first_name: 'Secret' }] });
    expect(await readOfficeLivePresence(input)).toMatchObject({ ok: true, data: { onlineCount: 0, rows: [{ employeeName: 'Name nicht verfügbar' }] } });
  });
});
