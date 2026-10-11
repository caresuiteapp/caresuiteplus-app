import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ from: vi.fn(), appointments: vi.fn(), documents: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: f.from }) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => f.from(table) }));
vi.mock('@/lib/portal/portalAppointmentsLiveService', () => ({ fetchLivePortalAppointmentsForEmployeeTeam: f.appointments }));
vi.mock('@/lib/portal/portalDocumentsLiveService', () => ({ fetchEmployeePortalClientDocuments: f.documents }));
import { fetchEmployeePortalClientRecordDetail, fetchEmployeePortalClientRecords } from '@/lib/portal/employeePortalClientRecordsService';

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let errors: Record<string, unknown>;
let ranges: { table: string; from: number; to: number }[];
const client = (id: string): Row => ({ id, tenant_id: 'tenant-1', status: 'active', deleted_at: null, first_name: 'Anna', last_name: id, mobile: null, phone: '123' });
const visit = (patch: Row = {}): Row => ({ id: 'visit-1', tenant_id: 'tenant-1', client_id: 'client-1', employee_id: 'employee-1', employee_portal_visible: false, planning_status: 'planned', planned_start_at: '2099-01-01T12:00:00Z', canonical_status: 'confirmed', client_visible_notes: 'Klingeln', ...patch });
beforeEach(() => {
  vi.clearAllMocks();
  tables = { clients: [client('client-1')], assist_visits: [], client_contacts: [], client_addresses: [] };
  errors = {}; ranges = [];
  f.appointments.mockResolvedValue({ ok: true, data: [] });
  f.documents.mockResolvedValue({ ok: true, data: [] });
  f.from.mockImplementation((table: string) => {
    const predicates: ((row: Row) => boolean)[] = [];
    let from = 0; let to = Infinity;
    const query: Record<string, unknown> = {};
    query.select = () => query; query.order = () => query;
    query.eq = (key: string, value: unknown) => { predicates.push((row) => row[key] === value); return query; };
    query.neq = (key: string, value: unknown) => { predicates.push((row) => row[key] !== value); return query; };
    query.is = (key: string, value: unknown) => { predicates.push((row) => row[key] === value); return query; };
    query.not = (key: string, _operator: string, value: unknown) => { predicates.push((row) => row[key] !== value); return query; };
    query.in = (key: string, values: unknown[]) => { predicates.push((row) => values.includes(row[key])); return query; };
    query.limit = (limit: number) => { to = limit - 1; return query; };
    query.range = (start: number, end: number) => { from = start; to = end; ranges.push({ table, from, to }); return query; };
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({
      data: (tables[table] ?? []).filter((row) => predicates.every((predicate) => predicate(row))).slice(from, to + 1), error: errors[table] ?? null,
    }).then(resolve);
    return query;
  });
});
describe('Employee client directory and detail projections', () => {
  it('includes all active tenant clients but never reintroduces paused/deleted clients from historical visits', async () => {
    tables.clients.push({ ...client('paused'), status: 'paused' }, { ...client('deleted'), deleted_at: '2026-01-01' });
    tables.assist_visits.push(visit(), visit({ client_id: 'paused' }), visit({ client_id: 'deleted' }), visit({ client_id: 'foreign' }));
    const result = await fetchEmployeePortalClientRecords('tenant-1', 'employee-1');
    expect(result).toMatchObject({ ok: true, data: [{ clientId: 'client-1', hints: 'Klingeln', activeAssignmentCount: 1 }] });
    expect(result.ok && result.data).toHaveLength(1);
  });
  it('reads a second page instead of silently cutting the directory at a server cap', async () => {
    tables.clients = Array.from({ length: 501 }, (_, index) => client(`client-${index}`));
    const result = await fetchEmployeePortalClientRecords('tenant-1', 'employee-1');
    expect(result.ok && result.data).toHaveLength(501);
    expect(ranges).toContainEqual({ table: 'clients', from: 500, to: 999 });
  });
  it('does not label a cancelled future visit as the next appointment', async () => {
    tables.assist_visits = [visit({ canonical_status: 'cancelled' })];
    expect(await fetchEmployeePortalClientRecords('tenant-1', 'employee-1')).toMatchObject({ ok: true, data: [{ nextAssignmentAt: null, activeAssignmentCount: 0 }] });
  });
  it('retains complete history and distinguishes failed contacts/documents/access from an empty record', async () => {
    f.appointments.mockResolvedValue({ ok: true, data: Array.from({ length: 40 }, (_, index) => ({ id: `visit-${index}`, clientId: 'client-1', title: 'Besuch', startsAt: '2026-10-01T12:00:00Z', assignmentStatus: 'abgeschlossen' })) });
    f.documents.mockResolvedValue({ ok: false, error: 'Dokumentabruf verweigert.' });
    errors.client_contacts = { message: 'Kontaktabruf fehlgeschlagen' };
    errors.client_addresses = { message: 'Zugangsabruf fehlgeschlagen' };
    const result = await fetchEmployeePortalClientRecordDetail('tenant-1', 'employee-1', 'client-1');
    expect(result.ok && result.data?.assignmentHistory).toHaveLength(40);
    expect(result).toMatchObject({ ok: true, data: { documentsError: 'Dokumentabruf verweigert.', contactsError: expect.any(String), accessError: expect.any(String) } });
  });
  it('fails closed for missing context without reading an unscoped table', async () => {
    expect((await fetchEmployeePortalClientRecords('tenant-1', '')).ok).toBe(false);
    expect(f.from).not.toHaveBeenCalled();
  });
});
