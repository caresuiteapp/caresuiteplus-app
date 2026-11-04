import type { PayrollCatchUpTimeEntry, PayrollDeferredTimeEntry } from '@/types/modules/payrollMonth';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { officeAccountRecordedMinutes } from '@/lib/wfm/wfmOfficeAccountTotals';
import { isPayrollDate, payrollDeferredReason, type PayrollRow } from './payrollOfficeReadModel.web';

export const payrollPeriodNumber = (year: number, month: number) => year * 12 + month;
export function deferredPayrollEntry(entry: WfmOfficeTimeEntry, reason: PayrollDeferredTimeEntry['reason']): PayrollDeferredTimeEntry {
  const originYear = Number(entry.workDate.slice(0, 4)), originMonth = Number(entry.workDate.slice(5, 7));
  return { key: `${entry.workDate.slice(0, 7)}:${entry.id}`, entryId: entry.id, originYear, originMonth, workDate: entry.workDate,
    assignmentId: entry.assignmentId, visitId: entry.visitId, sessionId: entry.sessionId, plannedStartAt: entry.plannedStartAt,
    clientLabel: entry.clientLabel, assignmentTitle: entry.assignmentTitle || 'Arbeitszeit', reason };
}
export function matchDeferredPayrollEntry(item: PayrollDeferredTimeEntry, entries: WfmOfficeTimeEntry[]): WfmOfficeTimeEntry | undefined {
  const sameDay = entries.filter(entry => entry.workDate === item.workDate);
  const exact = sameDay.filter(entry => entry.id === item.entryId);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;
  // A missing planned row receives a new source ID when the employee adds time.
  const occurrence = sameDay.filter(entry => (item.visitId && entry.visitId === item.visitId || item.assignmentId && entry.assignmentId === item.assignmentId)
    && (!item.plannedStartAt || Date.parse(entry.plannedStartAt ?? '') === Date.parse(item.plannedStartAt)));
  if (item.visitId || item.assignmentId) return occurrence.length === 1 ? occurrence[0] : undefined;
  // A daily session can contain several visits. Its ID cannot identify one of
  // those visits, even when only a different visit remains in the read model.
  const session = sameDay.filter(entry => item.sessionId && entry.sessionId === item.sessionId && !entry.visitId && !entry.assignmentId);
  return session.length === 1 ? session[0] : undefined;
}
export type PayrollTimeRegistry = { deferred: Map<string, PayrollDeferredTimeEntry>; settled: Map<string, { period: number; item: PayrollCatchUpTimeEntry }> };
export function payrollTimeRegistry(rows: PayrollRow[], employeeId: string): PayrollTimeRegistry {
  const deferred = new Map<string, PayrollDeferredTimeEntry>(), settled = new Map<string, { period: number; item: PayrollCatchUpTimeEntry }>();
  const history = rows.filter(row => row.employee_id === employeeId && row.status !== 'draft')
    .sort((a, b) => payrollPeriodNumber(Number(a.period_year), Number(a.period_month)) - payrollPeriodNumber(Number(b.period_year), Number(b.period_month)) || Number(a.version) - Number(b.version));
  for (const row of history) {
    const snapshot = row.snapshot_json as PayrollRow | undefined;
    const pending = row.deferred_time_entries ?? snapshot?.deferredTimeEntries ?? [];
    const included = row.catch_up_time_entries ?? snapshot?.catchUpTimeEntries ?? [];
    if (!Array.isArray(pending) || !Array.isArray(included)) throw new Error('Die gespeicherten Zeitnachberechnungen sind unvollständig.');
    for (const raw of pending) {
      const item = raw as PayrollDeferredTimeEntry;
      if (!item || !isPayrollDate(item.workDate) || !item.entryId || item.key !== `${item.workDate.slice(0, 7)}:${item.entryId}`
        || item.originYear !== Number(item.workDate.slice(0, 4)) || item.originMonth !== Number(item.workDate.slice(5, 7))) throw new Error('Eine zurückgestellte Zeit besitzt keine eindeutige Herkunft.');
      if (!deferred.has(item.key)) deferred.set(item.key, item);
    }
    for (const raw of included) {
      const item = raw as PayrollCatchUpTimeEntry;
      const period = payrollPeriodNumber(Number(row.period_year), Number(row.period_month));
      if (!item?.key || !item.sourceEntryId || !Number.isSafeInteger(item.minutes) || item.minutes < 0 || !Number.isSafeInteger(item.travelMinutes) || item.travelMinutes < 0) throw new Error('Eine gespeicherte Nachberechnung ist ungültig.');
      const prior = settled.get(item.key);
      if (prior && (prior.period !== period || prior.item.sourceEntryId !== item.sourceEntryId || prior.item.minutes !== item.minutes || prior.item.travelMinutes !== item.travelMinutes)) throw new Error('Eine Zeit wurde widersprüchlich nachberechnet. Bitte den Versionsverlauf prüfen.');
      if (!prior) settled.set(item.key, { period, item });
    }
  }
  return { deferred, settled };
}
export function resolvePayrollCatchUp(registry: PayrollTimeRegistry, entries: WfmOfficeTimeEntry[], year: number, month: number, now: number) {
  const selected = payrollPeriodNumber(year, month);
  const catchUp: PayrollCatchUpTimeEntry[] = [], pending: PayrollDeferredTimeEntry[] = [];
  const claimedEntries = new Set([...registry.settled.values()].map(value => value.item.sourceEntryId));
  for (const item of registry.deferred.values()) {
    if (payrollPeriodNumber(item.originYear, item.originMonth) >= selected) continue;
    const settled = registry.settled.get(item.key);
    if (settled) { if (settled.period === selected) catchUp.push(settled.item); continue; }
    const entry = matchDeferredPayrollEntry(item, entries);
    const complete = entry && payrollDeferredReason(entry, now) == null && entry.actualStartAt && entry.actualEndAt;
    // Ambiguous/missing sources remain pending; the same actual row cannot be credited twice.
    if (!complete || claimedEntries.has(entry.id)) { pending.push(item); continue; }
    claimedEntries.add(entry.id);
    catchUp.push({ ...item, sourceEntryId: entry.id, minutes: officeAccountRecordedMinutes(entry), travelMinutes: 0,
      actualStartAt: entry.actualStartAt!, actualEndAt: entry.actualEndAt!, reviewedAt: entry.reviewedAt ?? null });
  }
  return { catchUp, pending };
}
