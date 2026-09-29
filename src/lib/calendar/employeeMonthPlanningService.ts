import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { getServiceMode } from '@/lib/services/mode';
import { demoEmployees } from '@/data/demo/employees';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { berlinTimestamp, validatePlanningSlots, type EmployeeMonthPlan, type PlanningSlot } from './employeeMonthPlanning';

export type PlanningEmployee = { id: string; name: string };
export type PlanningSnapshot = { plans: EmployeeMonthPlan[]; absences: CalendarEvent[] };
const demoPlans = new Map<string, EmployeeMonthPlan>();
const keyOf = (tenant: string, employee: string, month: string) => `${tenant}:${employee}:${month}`;
function client() {
  const value = getSupabaseClient();
  if (!value) throw new Error('Keine Datenbankverbindung.');
  return value;
}
function fail(message: string): never {
  if (/calendar_employee_month_plans|calendar_save_employee_month|schema cache/i.test(message)) {
    throw new Error('Die monatliche Verfügbarkeitsplanung ist noch nicht eingerichtet. Bitte das Datenbank-Update einspielen.');
  }
  throw new Error(message);
}
export async function listPlanningEmployees(tenantId: string): Promise<PlanningEmployee[]> {
  if (getServiceMode() !== 'supabase') return demoEmployees.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }));
  const result: PlanningEmployee[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await fromUnknownTable(client(), 'employees').select('id,first_name,last_name')
      .eq('tenant_id', tenantId).is('deleted_at', null).order('id').range(page * 500, page * 500 + 499);
    if (error) fail(error.message);
    result.push(...(data ?? []).map((e) => ({ id: String(e.id), name: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim() })));
    if (!data || data.length < 500) break;
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
export async function loadPlanningSnapshot(tenantId: string, fromMonth: string, toMonth: string, employeeId: string): Promise<PlanningSnapshot> {
  if (getServiceMode() !== 'supabase') return {
    plans: [...demoPlans.values()].filter((p) => p.tenant_id === tenantId && p.month >= `${fromMonth}-01` && p.month <= `${toMonth}-01` && (!employeeId || p.employee_id === employeeId)),
    absences: [],
  };
  const db = client();
  const [endYear, endMonth] = toMonth.split('-').map(Number);
  const until = berlinTimestamp(new Date(Date.UTC(endYear, endMonth, 1)).toISOString().slice(0, 10), '00:00');
  const plans: EmployeeMonthPlan[] = [];
  for (let page = 0; ; page++) {
    let query = fromUnknownTable(db, 'calendar_employee_month_plans').select('tenant_id,employee_id,month,revision,slots')
      .eq('tenant_id', tenantId).gte('month', `${fromMonth}-01`).lte('month', `${toMonth}-01`).order('month').order('employee_id')
      .range(page * 500, page * 500 + 499);
    if (employeeId) query = query.eq('employee_id', employeeId);
    const { data, error } = await query;
    if (error) fail(error.message);
    plans.push(...(data ?? []) as EmployeeMonthPlan[]);
    if (!data || data.length < 500) break;
  }
  const absences: CalendarEvent[] = [];
  if (employeeId) {
    // Load separately from the display filters: hidden absence chips must still block availability.
    for (let page = 0; ; page++) {
      const { data, error } = await fromUnknownTable(db, 'workforce_absences')
        .select('id,employee_id,starts_at,ends_at,all_day,status')
        .eq('tenant_id', tenantId).eq('employee_id', employeeId)
        .in('status', ['requested', 'approved', 'active', 'completed'])
        .gte('ends_at', berlinTimestamp(`${fromMonth}-01`, '00:00')).lt('starts_at', until).order('id').range(page * 500, page * 500 + 499);
      if (error) fail(`Abwesenheiten konnten nicht sicher geprüft werden: ${error.message}`);
      absences.push(...(data ?? []).map((r) => ({
        id: `planning-block:${r.id}`, employeeId: String(r.employee_id), title: 'Abwesenheit',
        start: String(r.starts_at), end: String(r.ends_at), allDay: Boolean(r.all_day),
        type: 'abwesenheit' as const, color: '#A78BFA', status: String(r.status),
      })));
      if (!data || data.length < 500) break;
    }
  }
  return { plans, absences };
}
export async function saveEmployeeMonth(tenantId: string, employeeId: string, month: string, revision: number, slots: PlanningSlot[]): Promise<EmployeeMonthPlan> {
  const errors = validatePlanningSlots(slots, month);
  if (errors.length) throw new Error(errors.join('\n'));
  for (const slot of slots) { berlinTimestamp(slot.date, slot.startTime); berlinTimestamp(slot.date, slot.endTime); }
  if (getServiceMode() !== 'supabase') {
    const key = keyOf(tenantId, employeeId, month);
    if ((demoPlans.get(key)?.revision ?? 0) !== revision) throw new Error('Der Plan wurde zwischenzeitlich geändert. Bitte neu öffnen.');
    const plan = { tenant_id: tenantId, employee_id: employeeId, month: `${month}-01`, revision: revision + 1, slots: slots.map((slot) => ({ ...slot })) };
    demoPlans.set(key, plan);
    return plan;
  }
  const { data, error } = await client().rpc('calendar_save_employee_month' as never, {
    p_tenant_id: tenantId, p_employee_id: employeeId, p_month: `${month}-01`, p_expected_revision: revision, p_slots: slots,
  } as never);
  if (error) fail(error.message);
  return data as unknown as EmployeeMonthPlan;
}
