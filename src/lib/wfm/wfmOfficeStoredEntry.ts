import { evaluateVisitTimeDeviation, combineDeviationAmpel } from './wfmVisitDeviationAmpelService';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { enrichOfficeTimeEntryDisplay } from './wfmOfficeTimeDisplayResolver';

export function validateOfficeTimeValues(start: string | null | undefined, end: string | null | undefined, pause: number): string | null {
  const from = start ? Date.parse(start) : NaN;
  const to = end ? Date.parse(end) : NaN;
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 'Bitte Beginn und Ende vollständig und gültig angeben.';
  if (to <= from) return 'Das Ende muss nach dem Beginn liegen.';
  if (!Number.isInteger(pause) || pause < 0 || pause > Math.round((to - from) / 60000)) {
    return 'Die Pause muss eine ganze Minutenzahl zwischen 0 und der erfassten Dauer sein.';
  }
  return null;
}

export function recalculateOfficeEntry(entry: WfmOfficeTimeEntry): WfmOfficeTimeEntry {
  const grossMinutes = entry.actualStartAt && entry.actualEndAt
    ? Math.max(0, Math.round((Date.parse(entry.actualEndAt) - Date.parse(entry.actualStartAt)) / 60000)) : 0;
  const start = entry.plannedStartAt && entry.actualStartAt ? evaluateVisitTimeDeviation(entry.plannedStartAt, entry.actualStartAt, 'start') : null;
  const end = entry.plannedEndAt && entry.actualEndAt ? evaluateVisitTimeDeviation(entry.plannedEndAt, entry.actualEndAt, 'end') : null;
  return enrichOfficeTimeEntryDisplay({ ...entry, grossMinutes,
    startDeviationMinutes: start?.deviationMinutes ?? null, endDeviationMinutes: end?.deviationMinutes ?? null,
    startAmpel: start?.ampel ?? null, endAmpel: end?.ampel ?? null,
    overallAmpel: start && end ? combineDeviationAmpel(start.ampel, end.ampel) : start?.ampel ?? end?.ampel ?? null,
    netMinutes: Math.max(0, grossMinutes - entry.pauseMinutes),
    flags: entry.actualStartAt && entry.actualEndAt ? entry.flags.filter(f => f !== 'missing_booking' && f !== 'upcoming') : entry.flags,
  });
}

export function readStoredOfficeEntry(value: unknown, tenantId: string, employeeId: string, workDate: string): WfmOfficeTimeEntry | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as WfmOfficeTimeEntry;
  if (entry.tenantId !== tenantId || entry.employeeId !== employeeId || entry.workDate !== workDate
    || typeof entry.id !== 'string' || !entry.id || !Array.isArray(entry.flags)
    || !['correction', 'manual_addition'].includes(entry.source)
    || validateOfficeTimeValues(entry.actualStartAt, entry.actualEndAt, entry.pauseMinutes)) return null;
  return recalculateOfficeEntry(entry);
}

export function applyStoredOfficeEntry(entry: WfmOfficeTimeEntry, stored?: WfmOfficeTimeEntry | null): WfmOfficeTimeEntry {
  if (!stored || stored.tenantId !== entry.tenantId || stored.employeeId !== entry.employeeId || stored.workDate !== entry.workDate) return entry;
  return recalculateOfficeEntry({ ...entry, actualStartAt: stored.actualStartAt, actualEndAt: stored.actualEndAt,
    pauseMinutes: stored.pauseMinutes, workKind: stored.workKind, source: stored.source,
    officeComment: stored.officeComment, rowKind: entry.rowKind === 'planned_missing_actual' || entry.rowKind === 'planned_upcoming' ? 'planned_with_actual' : entry.rowKind,
  });
}
