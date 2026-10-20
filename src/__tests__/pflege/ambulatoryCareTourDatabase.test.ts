import { setupAmbulatoryDatabase } from './ambulatoryDatabaseFixture';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
const tenant = '11111111-1111-4111-8111-111111111111';
const foreign = '22222222-2222-4222-8222-222222222222';
const actor = '33333333-3333-4333-8333-333333333333';
const employee = '44444444-4444-4444-8444-444444444444';
const client = '55555555-5555-4555-8555-555555555555';
const foreignClient = '66666666-6666-4666-8666-666666666666';
let db: PGlite;
let tour: string;
let stop: string;
async function rpc(name: string, args: unknown[]) {
  const placeholders = args.map((_, index) => `$${index + 1}`).join(',');
  return (await db.query<{ result: { id: string } }>(`SELECT public.${name}(${placeholders}) AS result`, args)).rows[0].result;
}
const payload = (clientId = client, start = '07:00', end = '07:30') => ({ tourDate: '2026-10-02', name: 'Frühtour', employeeId: employee, stops: [{ clientId, plannedStart: start, plannedEnd: end, serviceSummary: 'Grundpflege' }] });
describe('Ambulante Touren: PostgreSQL transactions, RLS and evidence', () => {
  beforeAll(async () => {
    db = await setupAmbulatoryDatabase();
  }, 30000);
  afterAll(async () => { await db?.close(); });
  it('returns tenant resources with IDs rather than client-supplied snapshots', async () => {
    const r = await db.query<{ resources: { clients: { id: string }[] } }>('SELECT public.get_ambulatory_care_tour_resources() AS resources');
    expect(r.rows[0].resources.clients.map((c) => c.id)).toEqual([client]);
  });
  it('rejects a foreign client and atomically rolls back the entire tour', async () => {
    const p = payload(); p.stops.push({ ...p.stops[0], clientId: foreignClient, plannedStart: '08:00', plannedEnd: '08:30' });
    await expect(rpc('create_ambulatory_care_tour', [p])).rejects.toThrow(/aktiver Pflegefall/);
    expect((await db.query('SELECT id FROM public.care_tours')).rows).toHaveLength(0);
  });
  it('rejects overlap within the same tour', async () => {
    const p = payload(); p.stops.push({ ...p.stops[0], plannedStart: '07:15', plannedEnd: '07:45' });
    await expect(rpc('create_ambulatory_care_tour', [p])).rejects.toThrow(/überlappend/);
  });
  it('creates linked stops and blocks direct bypass writes', async () => {
    tour = (await rpc('create_ambulatory_care_tour', [payload()])).id;
    const rows = (await db.query<{ id: string; client_id: string }>('SELECT id,client_id FROM public.care_tour_stops')).rows;
    stop = rows[0].id; expect(rows[0].client_id).toBe(client);
    await expect(db.query("UPDATE public.care_tours SET status='completed'")).rejects.toThrow(/permission denied/);
    await expect(db.query('DELETE FROM public.care_tour_events')).rejects.toThrow(/permission denied/);
  });
  it('returns the same tour for a retried save and rejects modified retry payloads', async () => {
    const p = { ...payload(client, '09:00', '09:30'), requestId: '88888888-8888-4888-8888-888888888888' };
    const first = await rpc('create_ambulatory_care_tour', [p]);
    expect((await rpc('create_ambulatory_care_tour', [p])).id).toBe(first.id);
    await expect(rpc('create_ambulatory_care_tour', [{ ...p, name: 'Changed' }])).rejects.toThrow(/anderen Angaben/);
    await rpc('advance_ambulatory_care_tour', [first.id, 'cancelled', 'draft', 'Test beendet']);
  });
  it('enforces actor permissions even through RPC', async () => {
    await db.exec("SELECT set_config('test.permissions','pflege.plans.view',false)");
    await expect(rpc('advance_ambulatory_care_tour', [tour, 'published', 'draft', ''])).rejects.toThrow(/Berechtigung/);
    await db.exec("SELECT set_config('test.permissions','pflege.plans.view,pflege.plans.manage,pflege.documentation.create,pflege.proofs.create',false)");
  });
  it('rejects stale state and conflicts with another released tour', async () => {
    await rpc('advance_ambulatory_care_tour', [tour, 'published', 'draft', '']);
    await expect(rpc('advance_ambulatory_care_tour', [tour, 'published', 'draft', ''])).rejects.toThrow(/zwischenzeitlich/);
    const other = (await rpc('create_ambulatory_care_tour', [payload(client, '07:15', '07:45')])).id;
    await expect(rpc('advance_ambulatory_care_tour', [other, 'published', 'draft', ''])).rejects.toThrow(/überlappenden/);
    await expect(rpc('advance_ambulatory_care_tour', [other, 'cancelled', 'draft', ''])).rejects.toThrow(/Absagegrund/);
    await rpc('advance_ambulatory_care_tour', [other, 'cancelled', 'draft', 'Klient im Krankenhaus']);
  });
  it('cannot complete before every stop is terminal; creates clinical documentation on completion', async () => {
    await rpc('advance_ambulatory_care_tour', [tour, 'in_progress', 'published', '']);
    await expect(rpc('advance_ambulatory_care_tour', [tour, 'completed', 'in_progress', ''])).rejects.toThrow(/Alle Einsätze/);
    await rpc('advance_ambulatory_care_stop', [stop, 'arrived', 'planned', '']);
    await rpc('advance_ambulatory_care_stop', [stop, 'in_progress', 'arrived', '']);
    await expect(rpc('advance_ambulatory_care_stop', [stop, 'completed', 'in_progress', ''])).rejects.toThrow(/Durchführungsnachweis/);
    await rpc('advance_ambulatory_care_stop', [stop, 'completed', 'in_progress', 'Grundpflege durchgeführt, Haut intakt.']);
    const r = (await db.query<{ documentation_entry_id: string; actual_started_at: string; actual_ended_at: string }>('SELECT documentation_entry_id,actual_started_at,actual_ended_at FROM public.care_tour_stops WHERE id=$1', [stop])).rows[0];
    expect(r.documentation_entry_id).toBeTruthy(); expect(r.actual_started_at).toBeTruthy(); expect(r.actual_ended_at).toBeTruthy();
    await rpc('advance_ambulatory_care_tour', [tour, 'completed', 'in_progress', '']);
  });
  it('creates exactly one proof from trusted times and client; ignores forged source fields', async () => {
    const p = { legalBasis: 'sgb_xi', serviceCode: 'LK1', serviceLabel: 'Grundpflege', costCarrierName: 'Testkasse', grossAmountCents: 3275, unitPriceCents: 3275, quantity: 1, billingUnit: 'visit', clientId: foreignClient, startedAt: '1900-01-01T00:00:00Z', performanceNote: 'Forged' };
    const first = await rpc('create_ambulatory_care_stop_proof', [stop, p]);
    const second = await rpc('create_ambulatory_care_stop_proof', [stop, p]);
    expect(first.id).toBe(second.id);
    await db.exec('RESET ROLE');
    const proof = (await db.query<{ client_id: string; performance_note: string; evidence_snapshot: { createdPayload: { assignedEmployeeId: string } } }>('SELECT * FROM public.pfleger_service_proofs')).rows;
    expect(proof).toHaveLength(1); expect(proof[0].client_id).toBe(client); expect(proof[0].performance_note).toContain('Haut intakt'); expect(proof[0].evidence_snapshot.createdPayload.assignedEmployeeId).toBe(employee);
    await db.exec('SET ROLE authenticated');
  });
  it('captures a real signature reference, rejects arbitrary IDs, and enforces a second reviewer', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
    await db.exec("RESET ROLE");
    const proof = (await db.query<{ id: string }>('SELECT id FROM public.pfleger_service_proofs')).rows[0].id;
    await db.exec("SET ROLE authenticated; SELECT set_config('test.permissions','pflege.plans.view,pflege.proofs.view,pflege.proofs.sign,pflege.proofs.review',false)");
    await expect(rpc('advance_pfleger_service_proof', [proof, 'sign', { signatureName: 'Test', signatureRef: 'invented' }])).rejects.toThrow(/erfasste Unterschrift/);
    await rpc('capture_pfleger_proof_signature', [proof, 'Test Klient', png]);
    await rpc('capture_pfleger_proof_signature', [proof, 'Test Klient', png]);
    expect((await db.query('SELECT id FROM public.pfleger_signature_evidence')).rows).toHaveLength(1);
    await expect(rpc('advance_pfleger_service_proof', [proof, 'approve', {}])).rejects.toThrow(/zweite prüfende Person/);
    await db.exec("SELECT set_config('test.actor','77777777-7777-4777-8777-777777777777',false)");
    await rpc('advance_pfleger_service_proof', [proof, 'approve', {}]);
    await db.exec("RESET ROLE");
    expect((await db.query<{ status: string }>('SELECT status FROM public.pfleger_billing_cases')).rows[0].status).toBe('ready');
    await db.exec(`SET ROLE authenticated; SELECT set_config('test.actor','${actor}',false),set_config('test.permissions','pflege.plans.view,pflege.plans.manage,pflege.documentation.create,pflege.proofs.create',false)`);
  });
  it('isolates read and write access across tenants', async () => {
    await db.exec(`SELECT set_config('test.tenant','${foreign}',false)`);
    expect((await db.query('SELECT id FROM public.care_tours')).rows).toHaveLength(0);
    expect((await db.query('SELECT id FROM public.care_tour_events')).rows).toHaveLength(0);
    await expect(rpc('advance_ambulatory_care_tour', [tour, 'cancelled', 'completed', 'Forged'])).rejects.toThrow(/nicht gefunden/);
    await db.exec(`SELECT set_config('test.tenant','${tenant}',false)`);
  });
}, 60000);
