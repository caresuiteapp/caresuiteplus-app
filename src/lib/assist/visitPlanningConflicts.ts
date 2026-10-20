import type { AssignmentConflictCandidate } from './assignmentConflictService';
import type { VisitCreateWizardData } from './visitTypes';
import { buildPlannedTimestamps } from './assignmentProductionValidation';
import { expandVisitRecurrenceDates } from './calculateAssistBudgetAllocation';
import { parseVisitRecurrenceJson } from './visitRecurrenceExpansion';
import { berlinTimestamp } from '@/lib/calendar/employeeMonthPlanning';

export type VisitPlanningPeriod = { plannedStartAt: string; plannedEndAt: string };
export type VisitPlanningConflictRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  employee_id: string | null;
  title: string;
  canonical_status: AssignmentConflictCandidate['canonicalStatus'];
  assignment_date: string;
  planned_start_at: string;
  planned_end_at: string;
  recurrence_json?: unknown;
};

export function buildVisitPlanningPeriods(wizard: VisitCreateWizardData): VisitPlanningPeriod[] {
  const occurrenceDates = expandVisitRecurrenceDates({
    assignmentDate: wizard.assignmentDate,
    recurrencePattern: wizard.recurrencePattern,
    recurrenceWeekdays: wizard.recurrenceWeekdays,
    recurrenceEndDate: wizard.recurrenceEndDate || null,
    recurrenceOccurrenceCount: wizard.recurrenceOccurrenceCount,
    maxOccurrences: wizard.recurrenceOccurrenceCount ?? 366,
  });
  // The create flow writes the anchor and then occurrenceDates.slice(1).
  const dates = [...new Set([wizard.assignmentDate, ...occurrenceDates.slice(1)])];
  return dates.map(assignmentDate => buildPlannedTimestamps({ ...wizard, assignmentDate }));
}

function overlapsPeriod(start: string, end: string, periods: VisitPlanningPeriod[]): boolean {
  return periods.some(period => Date.parse(start) < Date.parse(period.plannedEndAt)
    && Date.parse(period.plannedStartAt) < Date.parse(end));
}

const berlinClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const berlinDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' });

/** Expand legacy virtual series as well as physical rows, using the German planning clock. */
export function expandVisitPlanningConflictCandidates(
  rows: VisitPlanningConflictRow[],
  periods: VisitPlanningPeriod[],
): AssignmentConflictCandidate[] {
  const candidates: AssignmentConflictCandidate[] = [];
  const lastDate = berlinDate.format(new Date(Math.max(...periods.map(period => Date.parse(period.plannedEndAt)))));
  for (const row of rows) {
    if (row.canonical_status === 'cancelled') continue;
    const add = (id: string, plannedStartAt: string, plannedEndAt: string) => {
      if (!Number.isFinite(Date.parse(plannedStartAt)) || !Number.isFinite(Date.parse(plannedEndAt))
        || Date.parse(plannedEndAt) <= Date.parse(plannedStartAt)) {
        throw new Error('Ein bestehender Einsatz enthält ungültige Terminzeiten. Bitte die Planung prüfen.');
      }
      if (overlapsPeriod(plannedStartAt, plannedEndAt, periods)) {
        candidates.push({ id, tenantId: row.tenant_id, clientId: row.client_id,
          employeeId: row.employee_id, title: row.title, canonicalStatus: row.canonical_status,
          plannedStartAt, plannedEndAt });
      }
    };
    add(row.id, row.planned_start_at, row.planned_end_at);
    const recurrence = parseVisitRecurrenceJson(row.recurrence_json);
    if (recurrence.pattern === 'none') continue;
    const anchor = recurrence.anchorDate ?? row.assignment_date;
    const maxOccurrences = Math.max(1, Math.ceil((Date.parse(lastDate) - Date.parse(anchor)) / 86_400_000) + 1);
    const dates = expandVisitRecurrenceDates({
      assignmentDate: anchor,
      recurrencePattern: recurrence.pattern,
      recurrenceWeekdays: recurrence.weekdays,
      recurrenceEndDate: recurrence.endDate && recurrence.endDate < lastDate ? recurrence.endDate : lastDate,
      recurrenceOccurrenceCount: recurrence.occurrenceCount,
      maxOccurrences,
    });
    const masterDate = recurrence.masterOccurrenceDate ?? row.assignment_date.slice(0, 10);
    const endDayOffset = Math.round((Date.parse(berlinDate.format(new Date(row.planned_end_at)))
      - Date.parse(berlinDate.format(new Date(row.planned_start_at)))) / 86_400_000);
    for (const date of dates) {
      if (date === masterDate || recurrence.detachedOccurrenceDates?.includes(date)
        || recurrence.materializedOccurrences?.[date]) continue;
      const endDate = new Date(Date.parse(date) + endDayOffset * 86_400_000).toISOString().slice(0, 10);
      add(`${row.id}::${date}`, berlinTimestamp(date, berlinClock.format(new Date(row.planned_start_at))),
        berlinTimestamp(endDate, berlinClock.format(new Date(row.planned_end_at))));
    }
  }
  return candidates;
}
