import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogbookTrip } from '@/types/modules/employeeLogbook';
import type { EmployeeLogbookGpsRecoveryCandidate } from '@/lib/employeeLogbook/employeeLogbookAssistGpsRecovery';

const state = vi.hoisted(() => ({ rows: [] as Record<string, any>[], claims: [] as Record<string, any>[], updates: [] as any[], zeroUpdate: false, error: null as string | null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) } }) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  let update: any; let single = false; const filters: [string, any][] = [];
  const run = () => {
    let rows = table === 'employee_logbook_trips' ? state.rows : table === 'employee_expense_claims' ? state.claims : table === 'assist_driving_log' ? [{ id: 'drive', tenant_id: 'tenant', employee_id: 'employee', notes: 'employee_logbook_trip:trip' }] : [];
    rows = rows.filter(row => filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value));
    if (update) {
      state.updates.push({ table, filters, update });
      if (state.error) return { data: null, error: { message: state.error } };
      if (state.zeroUpdate) rows = [];
      else rows.forEach(row => Object.assign(row, update));
    }
    return { data: single ? rows[0] ?? null : rows, error: null };
  };
  const q: any = { select: () => q, limit: () => q, eq: (key: string, value: any) => { filters.push([key, value]); return q; }, in: (key: string, value: any[]) => { filters.push([key, value]); return q; }, update: (value: any) => { update = value; return q; }, maybeSingle: () => { single = true; return Promise.resolve(run()); }, then: (resolve: any, reject: any) => Promise.resolve(run()).then(resolve, reject), insert: () => { throw new Error('Unexpected duplicate import'); } };
  return q;
} }));
import { deleteEmployeeLogbookTrip, correctLogbookTrip, correctLogbookTripDetails } from '@/lib/employeeLogbook/employeeLogbookRepository.supabase';
import { synchronizeEmployeeLogbookFromAssistGps } from '@/lib/employeeLogbook/employeeLogbookAssistGpsRecovery';
import { buildLogbookRecoveryView, canImportRecoveryLeg } from '@/lib/employeeLogbook/employeeLogbookRecoveryView';
const trip = { id: 'trip', tenantId: 'tenant', employeeId: 'employee', status: 'completed', distanceFinalKm: 8, purpose: 'Dienstfahrt', startedAt: '2026-08-27T06:17:00Z', source: 'assist_gps_recovery_r18:session:leg' } as LogbookTrip;
const leg = { id: 'leg', kind: 'approach', measuredDistanceKm: 8, googleGapDistanceKm: 0, resolvedGapCount: 0, reviewRequired: false, source: trip.source!, startedAt: trip.startedAt, endedAt: '2026-08-27T06:30:00Z', routeType: 'home_to_client', purpose: 'Anfahrt', imported: false, pointCount: 5, finalDistanceKm: 8, unresolvedGapCount: 0, points: [] } as EmployeeLogbookGpsRecoveryCandidate['legs'][number];
const candidate = { sessionId: 'session', source: 'assist_gps_recovery:session', startedAt: trip.startedAt, endedAt: leg.endedAt, legs: [leg], active: false, carSelectionProven: true, assignmentId: 'assignment' } as EmployeeLogbookGpsRecoveryCandidate;
beforeEach(() => { state.rows = [{ id: 'trip', tenant_id: 'tenant', employee_id: 'employee', status: 'completed', source: trip.source }]; state.claims = []; state.updates = []; state.zeroUpdate = false; state.error = null; });

describe('Confirmed logbook deletion', () => {
  it.each(['submitted', 'approved', 'rejected'])('removes trips with an unpaid %s claim', async status => {
    state.claims = [{ id: 'claim', tenant_id: 'tenant', employee_id: 'employee', driving_log_id: 'drive', status }];
    await deleteEmployeeLogbookTrip({ trip, reason: 'Falsche Erfassung' });
    expect(state.rows[0].status).toBe('cancelled');
    expect(state.updates[0].filters).toEqual(expect.arrayContaining([['tenant_id', 'tenant'], ['employee_id', 'employee'], ['status', 'completed']]));
  });
  it('keeps reimbursed trips protected', async () => {
    state.claims = [{ id: 'claim', tenant_id: 'tenant', employee_id: 'employee', driving_log_id: 'drive', status: 'reimbursed' }];
    await expect(deleteEmployeeLogbookTrip({ trip, reason: 'Falsche Erfassung' })).rejects.toThrow('ausgezahlt');
    expect(state.updates).toHaveLength(0);
  });
  it('does not report zero affected rows as success', async () => {
    state.zeroUpdate = true;
    await expect(deleteEmployeeLogbookTrip({ trip, reason: 'Falsche Erfassung' })).rejects.toThrow('nicht gelöscht');
  });
  it('accepts an already confirmed cancellation on retry', async () => {
    state.rows[0].status = 'cancelled';
    await expect(deleteEmployeeLogbookTrip({ trip, reason: 'Falsche Erfassung' })).resolves.toBeUndefined();
  });
  it('does not confuse an inaccessible trip with a deleted trip', async () => {
    state.rows[0].tenant_id = 'another-tenant';
    await expect(deleteEmployeeLogbookTrip({ trip, reason: 'Falsche Erfassung' })).rejects.toThrow('nicht gelöscht');
  });
  it('surfaces the database rejection without removing the row', async () => {
    state.error = 'Auszahlung wurde inzwischen abgeschlossen';
    await expect(deleteEmployeeLogbookTrip({ trip, reason: 'Falsche Erfassung' })).rejects.toThrow(state.error);
    expect(state.rows[0].status).toBe('completed');
  });
  it('cannot revive a deleted trip from a stale kilometre editor', async () => {
    state.rows[0].status = 'cancelled';
    await expect(correctLogbookTrip(trip, 10, 'Korrektur')).rejects.toThrow('nicht gespeichert');
    expect(state.rows[0].status).toBe('cancelled');
  });
  it('cannot revive a deleted trip from the full editor', async () => {
    state.rows[0].status = 'cancelled';
    await expect(correctLogbookTripDetails({ trip, vehicleId: 'vehicle', routeType: 'other_business', purpose: 'Dienstfahrt', reason: 'Korrektur', distanceKm: 10, startedAt: trip.startedAt, endedAt: leg.endedAt, startAddress: 'Start', endAddress: 'Ziel' })).rejects.toThrow('nicht gespeichert');
    expect(state.rows[0].status).toBe('cancelled');
  });
  it('does not reimport a cancelled source even with stale GPS candidates', async () => {
    state.rows[0].status = 'cancelled';
    const result = await synchronizeEmployeeLogbookFromAssistGps({ tenantId: 'tenant', employeeId: 'employee', vehicleId: 'vehicle', candidates: [candidate] });
    expect(result.importedCount).toBe(0);
    expect(state.rows[0].status).toBe('cancelled');
  });
});

describe('Compact GPS actions', () => {
  it('limits records to the selected Berlin period', () => {
    const september = { ...candidate, startedAt: '2026-08-31T22:30:00Z' };
    expect(buildLogbookRecoveryView([candidate, september], [], '2026-08-01', '2026-08-31')).toHaveLength(1);
  });
  it('links a current trip for editing and clears handled review status', () => {
    const view = buildLogbookRecoveryView([candidate], [{ ...trip, status: 'corrected' }], '2026-08-01', '2026-08-31')[0];
    expect(view.legs[0].trip?.id).toBe('trip'); expect(view.needsAction).toBe(false);
  });
  it('keeps deletions out of active actions despite stale GPS flags', () => {
    const view = buildLogbookRecoveryView([candidate], [{ ...trip, status: 'cancelled' }], '2026-08-01', '2026-08-31')[0];
    expect(view.legs[0].deleted).toBe(true); expect(view.needsAction).toBe(false);
    expect(canImportRecoveryLeg(view, view.legs[0])).toBe(false);
  });
  it('does not fill the default review list with empty sessions', () => {
    const view = buildLogbookRecoveryView([{ ...candidate, legs: [], pointCount: 0 }], [], '2026-08-01', '2026-08-31')[0];
    expect(view.needsAction).toBe(false);
  });
  it('requires closed, complete and explicitly car-enabled GPS before import', () => {
    expect(canImportRecoveryLeg(candidate, leg)).toBe(true);
    expect(canImportRecoveryLeg({ ...candidate, carSelectionProven: false }, leg)).toBe(false);
    expect(canImportRecoveryLeg({ ...candidate, active: true }, leg)).toBe(false);
    expect(canImportRecoveryLeg(candidate, { ...leg, unresolvedGapCount: 1 })).toBe(false);
  });
});
