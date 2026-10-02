import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupAmbulatoryDatabase } from './ambulatoryDatabaseFixture';
const client = '55555555-5555-4555-8555-555555555555';
const foreignClient = '66666666-6666-4666-8666-666666666666';
const employee = '44444444-4444-4444-8444-444444444444';
const tenant = '11111111-1111-4111-8111-111111111111';
let db: PGlite; let admission: string; let shift: string; let tariff: string; let tour: string; let stop: string; let order: string;
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
async function rpc(name: string, args: unknown[]) { return (await db.query<{ result: { id: string } }>(`SELECT public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) AS result`, args)).rows[0].result; }
async function stamp(table: string, id: string) { return (await db.query<{ at: string }>(`SELECT updated_at::text AS at FROM public.${table} WHERE id=$1`, [id])).rows[0].at; }
const admissionPayload = { clientId: client, startsOn: day, endsOn: '', basis: 'sgb_v', payerName: 'Testkasse', payerIk: '123456789', contractReference: 'Testvertrag', costInformationReference: 'Kosteninformation', emergencyContact: '', accessNotes: '' };
const price = { code: 'TEST-01', label: 'Testleistung', basis: 'sgb_v', unit: 'visit', unitPriceCents: 3275, validFrom: day, validUntil: '', payerIk: '123456789', agreementReference: 'Testpreisvereinbarung' };
describe('Ambulanter Betrieb: vollständige Datenbankkette und negative Pfade', () => {
  beforeAll(async () => { db = await setupAmbulatoryDatabase(true); }, 30000);
  afterAll(async () => { await db?.close(); });
  it('rejects foreign tenant admission and leaves no records', async () => {
    await expect(rpc('save_ambulatory_care_admission', [null, null, { ...admissionPayload, clientId: foreignClient }])).rejects.toThrow(/aktiven Pflegefall/);
    expect((await db.query('SELECT * FROM public.care_admissions')).rows).toHaveLength(0);
  });
  it('requires contract and cost information before release', async () => {
    admission = (await rpc('save_ambulatory_care_admission', [null, null, { ...admissionPayload, contractReference: '' }])).id;
    await expect(rpc('advance_ambulatory_care_admission', [admission, await stamp('care_admissions', admission), 'active', ''])).rejects.toThrow(/Pflegevertrag/);
    await rpc('save_ambulatory_care_admission', [admission, await stamp('care_admissions', admission), admissionPayload]);
    await rpc('advance_ambulatory_care_admission', [admission, await stamp('care_admissions', admission), 'active', '']);
    await expect(rpc('save_ambulatory_care_admission', [admission, await stamp('care_admissions', admission), admissionPayload])).rejects.toThrow(/geschützt/);
  });
  it('prevents direct writes and hides records from another tenant', async () => {
    await expect(db.exec("UPDATE public.care_admissions SET status='active'")).rejects.toThrow(/permission denied/);
    await db.exec("SELECT set_config('test.tenant','22222222-2222-4222-8222-222222222222',false)");
    expect((await db.query('SELECT * FROM public.care_admissions')).rows).toHaveLength(0);
    await db.exec(`SELECT set_config('test.tenant','${tenant}',false)`);
  });
  it('requires planned breaks and permits valid release', async () => {
    const payload = { employeeId: employee, shiftDate: day, startTime: '06:00', endTime: '14:00', breakMinutes: 0 };
    await expect(rpc('create_ambulatory_care_shift', [payload])).rejects.toThrow(/Pause/);
    shift = (await rpc('create_ambulatory_care_shift', [{ ...payload, breakMinutes: 30, breakStart: '11:00' }])).id;
    await rpc('advance_ambulatory_care_shift', [shift, await stamp('care_staff_shifts', shift), 'published', '']);
    await expect(db.exec("UPDATE public.care_staff_shifts SET status='published'")).rejects.toThrow(/permission denied/);
  });
  it('blocks overlaps or insufficient standard rest across released shifts', async () => {
    const another = (await rpc('create_ambulatory_care_shift', [{ employeeId: employee, shiftDate: day, startTime: '15:00', endTime: '18:00', breakMinutes: 0 }])).id;
    await expect(rpc('advance_ambulatory_care_shift', [another, await stamp('care_staff_shifts', another), 'published', ''])).rejects.toThrow(/ruhezeit/i);
  });
  it('does not release tours outside shift coverage or inside planned breaks', async () => {
    const payload = { tourDate: day, name: 'Testtour', employeeId: employee, stops: [{ clientId: client, plannedStart: '11:00', plannedEnd: '11:20', serviceSummary: 'Testleistung' }] };
    const bad = (await rpc('create_ambulatory_care_tour', [payload])).id;
    await expect(rpc('advance_ambulatory_care_tour', [bad, 'published', 'draft', ''])).rejects.toThrow(/Pausen/);
    tour = (await rpc('create_ambulatory_care_tour', [{ ...payload, stops: [{ ...payload.stops[0], plannedStart: '07:00', plannedEnd: '07:30' }] }])).id;
    await rpc('advance_ambulatory_care_tour', [tour, 'published', 'draft', '']);
    await expect(rpc('advance_ambulatory_care_shift', [shift, await stamp('care_staff_shifts', shift), 'cancelled', 'Vertretung fehlt'])).rejects.toThrow(/Tour/);
  });
  it('keeps immutable tariff versions and rejects overlapping or invalid prices', async () => {
    tariff = (await rpc('create_ambulatory_care_tariff', [price])).id;
    await expect(rpc('create_ambulatory_care_tariff', [price])).rejects.toThrow(/bereits ein Tarif/);
    await expect(rpc('create_ambulatory_care_tariff', [{ ...price, code: 'ZERO', unitPriceCents: 0 }])).rejects.toThrow();
    await expect(db.exec('UPDATE public.care_tariffs SET unit_price_cents=1')).rejects.toThrow(/permission denied/);
  });
  it('records execution and blocks SGB V proof without an approved order', async () => {
    await rpc('advance_ambulatory_care_tour', [tour, 'in_progress', 'published', '']);
    stop = (await db.query<{ id: string }>('SELECT id FROM public.care_tour_stops WHERE tour_id=$1', [tour])).rows[0].id;
    await rpc('advance_ambulatory_care_stop', [stop, 'arrived', 'planned', '']);
    await rpc('advance_ambulatory_care_stop', [stop, 'in_progress', 'arrived', '']);
    await rpc('advance_ambulatory_care_stop', [stop, 'completed', 'in_progress', 'Testdurchführung dokumentiert']);
    await expect(rpc('create_catalog_care_stop_proof', [stop, tariff, 1, null])).rejects.toThrow(/Verordnung/);
    order = (await rpc('manage_ambulatory_care_order', [null, null, { clientId: client, orderType: 'HKP', title: 'Testverordnung', description: 'Testmaßnahme', orderingPhysician: 'Testarzt', orderedAt: day, validFrom: day, validUntil: day, approvalRequired: true }])).id;
    await expect(rpc('create_catalog_care_stop_proof', [stop, tariff, 1, order])).rejects.toThrow(/genehmigung/i);
  });
  it('requires approval evidence, rejects stale updates and derives price from catalog', async () => {
    const old = await stamp('care_medical_orders', order);
    await expect(rpc('manage_ambulatory_care_order', [order, old, { action: 'approval', approvalStatus: 'approved', reason: 'Bescheid', approvalReference: '' }])).rejects.toThrow(/Genehmigungsreferenz/);
    await rpc('manage_ambulatory_care_order', [order, old, { action: 'approval', approvalStatus: 'approved', reason: 'Bescheid geprüft', approvalReference: 'TEST-APPROVAL' }]);
    await expect(rpc('manage_ambulatory_care_order', [order, old, { action: 'status', status: 'paused', reason: 'Test' }])).rejects.toThrow(/geändert/);
    const proof = await rpc('create_catalog_care_stop_proof', [stop, tariff, 2, order]);
    const result = await db.query<{ gross_amount_cents: number; tariff_id: string; admission_id: string }>('SELECT gross_amount_cents,tariff_id,admission_id FROM public.pfleger_service_proofs WHERE id=$1', [proof.id]);
    expect(result.rows[0]).toEqual({ gross_amount_cents: 6550, tariff_id: tariff, admission_id: admission });
    expect(await rpc('create_catalog_care_stop_proof', [stop, tariff, 2, order])).toEqual(proof);
  });
  it('persists tasks and requires completion evidence', async () => {
    const task = (await rpc('save_ambulatory_care_task', [null, null, { title: 'Test-Wiedervorlage', dueOn: day, clientId: client, priority: 'urgent' }])).id;
    await expect(rpc('save_ambulatory_care_task', [task, await stamp('care_operations_tasks', task), { status: 'done', resolution: '' }])).rejects.toThrow(/Ergebnis/);
    await rpc('save_ambulatory_care_task', [task, await stamp('care_operations_tasks', task), { status: 'done', resolution: 'Rückfrage geklärt' }]);
    expect((await db.query('SELECT * FROM public.care_operations_events')).rows.length).toBeGreaterThan(8);
  });
});
