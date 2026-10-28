import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), client: vi.fn(), from: vi.fn(), single: vi.fn(), upsert: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: f.get, setItem: f.set } }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: f.client }));
import { loadEmployeePortalMobilitySelection, saveEmployeePortalMobilitySelection } from '@/lib/portal/employeePortalMobilitySelection';
const scope = { tenantId: 'tenant-a', employeeId: 'employee-a', assignmentId: 'visit-a', mode: 'car' as const };
const local = { ...scope, selectedAt: '2026-10-26T14:00:00Z', serverSynced: false };
let query: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; maybeSingle: typeof f.single; upsert: typeof f.upsert };
describe('employee mobility network recovery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    query = { select: vi.fn(), eq: vi.fn(), maybeSingle: f.single, upsert: f.upsert };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    f.from.mockReturnValue(query); f.client.mockReturnValue({ from: f.from });
    f.get.mockResolvedValue(JSON.stringify(local)); f.set.mockResolvedValue(undefined);
    f.single.mockResolvedValue({ data: null, error: null }); f.upsert.mockResolvedValue({ error: null });
  });
  it.each(['sync', 'async'])('loads the scoped local selection after a %s transport failure', async (kind) => {
    if (kind === 'sync') f.from.mockImplementation(() => { throw Error('Transport unavailable'); });
    else f.single.mockRejectedValue(Error('Network disconnected'));
    await expect(loadEmployeePortalMobilitySelection('tenant-a', 'employee-a', 'visit-a')).resolves.toEqual(local);
    expect(f.get).toHaveBeenCalledWith('caresuite:employee-portal:mobility-selection:v1:tenant-a:employee-a:visit-a');
  });
  it('accepts a successful server read and filters tenant, employee and assignment', async () => {
    f.single.mockResolvedValue({ data: { transport_mode: 'walking', selected_at: local.selectedAt }, error: null });
    await expect(loadEmployeePortalMobilitySelection('tenant-a', 'employee-a', 'visit-a')).resolves.toMatchObject({ ...scope, mode: 'walking', serverSynced: true });
    expect(query.eq.mock.calls).toEqual([['tenant_id', 'tenant-a'], ['employee_id', 'employee-a'], ['assignment_id', 'visit-a']]);
    expect(f.get).not.toHaveBeenCalled();
  });
  it('never restores another employee selection after a failed server read', async () => {
    f.single.mockRejectedValue(Error('Network disconnected')); f.get.mockResolvedValue(JSON.stringify({ ...local, employeeId: 'employee-b' }));
    await expect(loadEmployeePortalMobilitySelection('tenant-a', 'employee-a', 'visit-a')).resolves.toBeNull();
  });
  it.each(['rejection', 'returned-error'])('keeps local persistence explicit after a server %s', async (kind) => {
    if (kind === 'rejection') f.upsert.mockRejectedValue(Error('Network disconnected')); else f.upsert.mockResolvedValue({ error: { message: 'Denied' } });
    const saved = await saveEmployeePortalMobilitySelection(scope);
    expect(saved).toMatchObject({ ...scope, serverSynced: false, syncError: expect.stringContaining('Serverabgleich ausstehend') });
    expect(f.set).toHaveBeenCalledWith('caresuite:employee-portal:mobility-selection:v1:tenant-a:employee-a:visit-a', expect.any(String));
    expect(JSON.parse(f.set.mock.calls[0][1])).toMatchObject(scope);
  });
  it('does not claim local persistence or contact the server when device storage rejects', async () => {
    f.set.mockRejectedValue(Error('Storage unavailable'));
    await expect(saveEmployeePortalMobilitySelection(scope)).rejects.toThrow('Storage unavailable');
    expect(f.client).not.toHaveBeenCalled(); expect(f.upsert).not.toHaveBeenCalled();
  });
});
