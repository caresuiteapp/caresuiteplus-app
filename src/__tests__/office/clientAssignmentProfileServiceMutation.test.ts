import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientAssignmentProfileInput } from '@/types/modules/clientAssignmentProfile';
const f = vi.hoisted(() => ({ mode: 'supabase', rpc: vi.fn(), query: {} as any, reply: { data: null, error: null } as any }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => f.mode }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: f.rpc }) }));
vi.mock('@/lib/tenant/tenantResolver', () => ({ assertTenantForMode: (tenant: string) => tenant.trim() ? null : { ok: false, error: 'Mandant fehlt.' } }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => f.query }));
import { archiveClientAssignmentProfile, saveClientAssignmentProfile, scheduleClientAssignmentProfile, validateClientAssignmentProfileInput } from '@/lib/office/clientAssignmentProfileService';
const input = (): ClientAssignmentProfileInput => ({
  clientId: 'client-a', employeeId: 'employee-a', profileName: 'Haushalt', assignmentTitle: 'Betreuung', description: '', durationMinutes: 60,
  taskTitles: ['Einkaufen'], taskDrafts: [], serviceKey: '', serviceName: '', subjectKey: '', assignmentTypeKey: '', serviceCategoryKey: '', taskPackageId: null,
  billingBudgetSourceKey: '', riskFlagKeys: [], documentationTemplateKey: '', proofTemplateKey: '', catalogSnapshotJson: {}, locationAddress: '', locationNotes: '',
  notesForEmployee: '', internalNotes: '', clientVisibleNotes: '', billingRelevant: true, requiresSignature: true, requiresDocumentation: true, requiresRoute: false, clientPortalVisible: true, employeePortalVisible: true,
});
const receipt = { assignmentId: 'assignment-a', profileId: 'profile-a', status: 'confirmed', startAt: '2026-10-12T08:00:00Z', endAt: '2026-10-12T09:00:00Z' };
beforeEach(() => {
  vi.clearAllMocks(); f.mode = 'supabase'; f.reply = { data: null, error: null }; f.rpc.mockResolvedValue({ data: receipt, error: null });
  f.query = {}; for (const key of ['update', 'insert', 'eq', 'select']) f.query[key] = vi.fn(() => f.query);
  f.query.single = vi.fn(async () => f.reply);
});
describe('Profile write scope and positive database receipts', () => {
  it('filters profile updates by tenant, client and profile ID', async () => {
    await saveClientAssignmentProfile('tenant-a', input(), 'profile-a');
    expect(f.query.eq.mock.calls).toEqual([['tenant_id', 'tenant-a'], ['client_id', 'client-a'], ['id', 'profile-a']]);
  });
  it('does not report archival success without an affected row', async () => {
    const result = await archiveClientAssignmentProfile('tenant-a', 'profile-a'); expect(result.ok).toBe(false); expect(f.query.single).toHaveBeenCalledOnce();
    f.reply = { data: { id: 'profile-a' }, error: null }; expect((await archiveClientAssignmentProfile('tenant-a', 'profile-a')).ok).toBe(true);
  });
  it('rejects missing tenant or profile before database access', async () => {
    expect((await archiveClientAssignmentProfile('', 'profile-a')).ok).toBe(false); expect((await archiveClientAssignmentProfile('tenant-a', '')).ok).toBe(false); expect(f.query.update).not.toHaveBeenCalled();
  });
  it.each([NaN, Infinity, 60.5])('rejects unusable duration %s before save', async (durationMinutes) => {
    expect(validateClientAssignmentProfileInput({ ...input(), durationMinutes })).not.toBeNull(); expect((await saveClientAssignmentProfile('tenant-a', { ...input(), durationMinutes })).ok).toBe(false); expect(f.query.insert).not.toHaveBeenCalled();
  });
  it('cannot update another tenant or client in the demo path', async () => {
    f.mode = 'demo'; const created = await saveClientAssignmentProfile('demo-a', input()); expect(created.ok).toBe(true); if (!created.ok) return;
    expect((await saveClientAssignmentProfile('demo-b', input(), created.data.id)).ok).toBe(false);
    expect((await saveClientAssignmentProfile('demo-a', { ...input(), clientId: 'client-b' }, created.data.id)).ok).toBe(false);
  });
});
describe('Scheduling input and receipt validation', () => {
  it.each([['2026-02-31', '10:00'], ['2026-10-12', '25:00'], ['2026-10-12', '10:60'], ['2026-03-29', '02:30']])('rejects invalid date or local time %s %s before RPC', async (date, time) => {
    expect((await scheduleClientAssignmentProfile('tenant-a', 'profile-a', date, time)).ok).toBe(false); expect(f.rpc).not.toHaveBeenCalled();
  });
  it.each([{ ...receipt, profileId: 'wrong' }, { ...receipt, status: 'draft' }, { ...receipt, assignmentId: '' }, { ...receipt, endAt: receipt.startAt }, { ...receipt, startAt: 'invalid' }])('classifies an incomplete or mismatched RPC receipt as uncertain', async (data) => {
    f.rpc.mockResolvedValue({ data, error: null }); expect(await scheduleClientAssignmentProfile('tenant-a', 'profile-a', '2026-10-12', '10:00')).toMatchObject({ ok: false, uncertain: true });
  });
  it('accepts a confirmed receipt for the requested profile', async () => {
    expect(await scheduleClientAssignmentProfile('tenant-a', 'profile-a', '2026-10-12', '10:00')).toEqual({ ok: true, data: receipt });
  });
  it('uses Berlin wall time for demo assignments independently of the host timezone', async () => {
    f.mode = 'demo'; const created = await saveClientAssignmentProfile('demo-berlin', input()); if (!created.ok) throw new Error(created.error);
    const result = await scheduleClientAssignmentProfile('demo-berlin', created.data.id, '2026-07-10', '10:00'); expect(result).toMatchObject({ ok: true, data: { startAt: '2026-07-10T08:00:00.000Z', endAt: '2026-07-10T09:00:00.000Z' } });
  });
});
