import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ from: vi.fn(), documents: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: f.from }) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => f.from(table) }));
vi.mock('@/lib/portal/portalDocumentsLiveService', () => ({ fetchEmployeePortalClientDocuments: f.documents }));
import {
  fetchEmployeePortalClientInsuranceNumber,
  fetchEmployeePortalClientRecordDetail,
  fetchEmployeePortalClientRecords,
} from '@/lib/portal/employeePortalClientRecordsService';

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let errors: Record<string, unknown>;
let ranges: { table: string; from: number; to: number }[];
let selections: { table: string; fields: string }[];
const id = (value: number) => `00000000-7777-4777-8777-${String(value).padStart(12, '0')}`;
const tenantId = id(1);
const employeeId = id(2);
const clientId = id(3);
const client = (id: string): Row => ({ id, tenant_id: tenantId, status: 'active', deleted_at: null, first_name: 'Anna', last_name: 'Muster', mobile: null, phone: '123' });
const visit = (patch: Row = {}): Row => ({
  id: id(10), tenant_id: tenantId, client_id: clientId, employee_id: employeeId, employee_portal_visible: true,
  planning_status: 'planned', planned_start_at: '2099-01-01T12:00:00Z', canonical_status: 'confirmed',
  client_visible_notes: 'Klingeln', title: 'Besuch', ...patch,
});

beforeEach(() => {
  vi.clearAllMocks();
  tables = { clients: [client(clientId)], assist_visits: [], client_contacts: [], client_addresses: [] };
  errors = {}; ranges = []; selections = [];
  f.documents.mockResolvedValue({ ok: true, data: [] });
  f.from.mockImplementation((table: string) => {
    const predicates: ((row: Row) => boolean)[] = [];
    let from = 0; let to = Infinity;
    const query: Record<string, unknown> = {};
    query.select = (fields: string) => { selections.push({ table, fields }); return query; };
    query.order = () => query;
    query.eq = (key: string, value: unknown) => {
      if (!key.includes('.')) predicates.push((row) => row[key] === value);
      return query;
    };
    query.neq = (key: string, value: unknown) => { predicates.push((row) => row[key] !== value); return query; };
    query.is = (key: string, value: unknown) => { predicates.push((row) => row[key] === value); return query; };
    query.not = (key: string, _operator: string, value: unknown) => { predicates.push((row) => row[key] !== value); return query; };
    query.or = () => { predicates.push((row) => row.is_primary_contact === true || row.is_emergency_contact === true); return query; };
    query.limit = (limit: number) => { to = limit - 1; return query; };
    query.range = (start: number, end: number) => { from = start; to = end; ranges.push({ table, from, to }); return query; };
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({
      data: (tables[table] ?? []).filter((row) => predicates.every((predicate) => predicate(row))).slice(from, to + 1), error: errors[table] ?? null,
    }).then(resolve);
    return query;
  });
});
describe('Employee client directory and detail projections', () => {
  it('uses the primary care fund and the Berlin birthday in register facts without requesting insurance numbers', async () => {
    tables.clients = [{
      ...client(clientId),
      date_of_birth: '1960-11-09',
      insurance_name: 'Kostenträger für sonstige Leistungen',
      primary_insurance: [{ tenant_id: tenantId, client_id: clientId, is_primary: true, care_fund_name: ' Pflegekasse Muster ' }],
    }];
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-08T23:10:00Z'));
    try {
      const basic = await fetchEmployeePortalClientRecords(tenantId, employeeId);
      expect(basic.ok && basic.data[0]).not.toHaveProperty('dateOfBirth');
      expect(selections[0].fields).not.toContain('date_of_birth');
      expect(await fetchEmployeePortalClientRecords(tenantId, employeeId, { includeRecordFacts: true })).toMatchObject({
        ok: true, data: [{ dateOfBirth: '09.11.1960', age: 66, careFundName: 'Pflegekasse Muster', legacyPayerName: null }],
      });
      expect(await fetchEmployeePortalClientRecordDetail(tenantId, employeeId, clientId)).toMatchObject({
        ok: true, data: { dateOfBirth: '09.11.1960', age: 66, careFundName: 'Pflegekasse Muster' },
      });
      expect(selections.every(({ fields }) => !fields.includes('insurance_number'))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the legacy payer separate and rejects invalid dates and foreign embedded insurance profiles', async () => {
    tables.clients = [{
      ...client(clientId),
      date_of_birth: '2001-02-29',
      insurance_name: 'Sozialamt Muster',
      primary_insurance: [{ tenant_id: id(9), client_id: clientId, is_primary: true, care_fund_name: 'Fremde Kasse' }],
    }];
    expect(await fetchEmployeePortalClientRecords(tenantId, employeeId, { includeRecordFacts: true })).toMatchObject({
      ok: true, data: [{ dateOfBirth: null, age: null, careFundName: null, legacyPayerName: 'Sozialamt Muster' }],
    });
  });

  it('fetches only the selected active record’s number and falls back to the number in the client record', async () => {
    tables.clients = [
      { ...client(clientId), insurance_number: 'TEST-ALT', primary_insurance: [
        { tenant_id: tenantId, client_id: clientId, is_primary: true, insurance_number: ' TEST-NEU ' },
      ] },
      { ...client(id(4)), insurance_number: 'TEST-BESTAND' },
      { ...client(id(5)), tenant_id: id(9), insurance_number: 'TEST-FREMD' },
      { ...client(id(6)), status: 'paused', insurance_number: 'TEST-INAKTIV' },
    ];
    expect(await fetchEmployeePortalClientInsuranceNumber(tenantId, employeeId, clientId)).toEqual({ ok: true, data: 'TEST-NEU' });
    expect(await fetchEmployeePortalClientInsuranceNumber(tenantId, employeeId, id(4))).toEqual({ ok: true, data: 'TEST-BESTAND' });
    expect((await fetchEmployeePortalClientInsuranceNumber(tenantId, employeeId, id(5))).ok).toBe(false);
    expect((await fetchEmployeePortalClientInsuranceNumber(tenantId, employeeId, id(6))).ok).toBe(false);
    expect(f.from.mock.calls.every(([table]) => table === 'clients')).toBe(true);
  });

  it('lists and opens active tenant records before the first assignment', async () => {
    tables.clients.push(
      client(id(4)),
      { ...client(id(5)), status: 'lead' },
      { ...client(id(6)), status: 'paused' },
      { ...client(id(7)), deleted_at: '2026-01-01' },
      { ...client(id(8)), tenant_id: id(9) },
    );
    tables.client_contacts = [{ id: id(11), tenant_id: tenantId, client_id: id(4), is_primary_contact: true, full_name: 'Hauptkontakt' }];
    const result = await fetchEmployeePortalClientRecords(tenantId, employeeId);
    expect(result.ok && result.data.map((record) => record.clientId)).toEqual([clientId, id(4)]);
    expect(await fetchEmployeePortalClientRecordDetail(tenantId, employeeId, id(4))).toMatchObject({
      ok: true,
      data: { clientId: id(4), phone: '123', assignmentHistory: [], contacts: [{ displayName: 'Hauptkontakt' }] },
    });
    for (const unavailable of [id(5), id(6), id(7), id(8)]) {
      expect(await fetchEmployeePortalClientRecordDetail(tenantId, employeeId, unavailable)).toEqual({ ok: true, data: null });
    }
    expect(f.documents).not.toHaveBeenCalled();
  });

  it('keeps the record usable if the visit history query fails', async () => {
    errors.assist_visits = { message: 'Einsatzabruf fehlgeschlagen' };
    expect(await fetchEmployeePortalClientRecords(tenantId, employeeId)).toMatchObject({
      ok: true, data: [{ clientId, activeAssignmentCount: 0, nextAssignmentAt: null }],
    });
    expect(await fetchEmployeePortalClientRecordDetail(tenantId, employeeId, clientId)).toMatchObject({
      ok: true, data: { clientId, assignmentHistory: [], assignmentHistoryError: expect.any(String) },
    });
  });

  it('reads a second page instead of silently cutting the directory at a server cap', async () => {
    tables.clients = Array.from({ length: 501 }, (_, index) => client(id(100 + index)));
    const result = await fetchEmployeePortalClientRecords(tenantId, employeeId);
    expect(result.ok && result.data).toHaveLength(501);
    expect(ranges).toContainEqual({ table: 'clients', from: 500, to: 999 });
  });

  it('does not label a cancelled future visit as the next appointment', async () => {
    tables.assist_visits = [visit({ canonical_status: 'cancelled' })];
    expect(await fetchEmployeePortalClientRecords(tenantId, employeeId)).toMatchObject({
      ok: true, data: [{ nextAssignmentAt: null, activeAssignmentCount: 0 }],
    });
  });

  it('keeps all own visible history and reports partial detail errors', async () => {
    tables.assist_visits = [
      ...Array.from({ length: 40 }, (_, index) => visit({ id: id(100 + index), canonical_status: 'completed' })),
      visit({ employee_id: id(9) }),
      visit({ employee_portal_visible: false }),
      visit({ planning_status: 'draft' }),
      visit({ client_id: null }),
    ];
    f.documents.mockResolvedValue({ ok: false, error: 'Dokumentabruf verweigert.' });
    errors.client_contacts = { message: 'Kontaktabruf fehlgeschlagen' };
    errors.client_addresses = { message: 'Zugangsabruf fehlgeschlagen' };
    const result = await fetchEmployeePortalClientRecordDetail(tenantId, employeeId, clientId);
    expect(result.ok && result.data?.assignmentHistory).toHaveLength(40);
    expect(result).toMatchObject({
      ok: true,
      data: { documentsError: 'Dokumentabruf verweigert.', contactsError: expect.any(String), accessError: expect.any(String) },
    });
  });

  it('fails closed for missing context without reading an unscoped table', async () => {
    expect((await fetchEmployeePortalClientRecords(tenantId, '')).ok).toBe(false);
    expect(f.from).not.toHaveBeenCalled();
  });
});
