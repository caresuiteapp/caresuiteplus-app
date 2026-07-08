import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { resolveWfmOfficeTimeDisplay } from './wfmOfficeTimeDisplayResolver';
import type {
  WfmAbsence,
  WfmAbsenceType,
  WfmEventSource,
  WfmTimeEvent,
  WfmWorkSession,
} from '@/types/modules/wfm';
import { formatWfmStatusLabel } from './wfmClockService';
import { WFM_WORK_TYPES } from './wfmWorkTypes';

export const WFM_EVENT_SOURCE_LABELS: Record<WfmEventSource, string> = {
  portal: 'Portal',
  office: 'Office',
  assist: 'Einsatz',
  system: 'System',
  import: 'Import',
  correction: 'Korrektur',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  clock_in: 'Arbeitsbeginn',
  clock_out: 'Feierabend',
  pause_start: 'Pause',
  pause_end: 'Fortsetzung',
  homeoffice_start: 'Home Office',
  homeoffice_end: 'Home Office Ende',
  office_check_in: 'Büro',
  office_check_out: 'Büro Ende',
  visit_drive_start: 'Anfahrt',
  visit_arrived: 'Angekommen',
  visit_started: 'Einsatz',
  visit_ended: 'Einsatz Ende',
  visit_paused: 'Einsatzpause',
  mode_switch: 'Moduswechsel',
  correction: 'Korrektur',
  manual_booking: 'Manuelle Buchung',
  standby_start: 'Bereitschaft',
  standby_end: 'Bereitschaft Ende',
  training_start: 'Fortbildung',
  training_end: 'Fortbildung Ende',
  meeting_start: 'Besprechung',
  meeting_end: 'Besprechung Ende',
  travel_start: 'Fahrt',
  travel_end: 'Fahrt Ende',
};

export function formatWfmTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/** ZEIT.3.1 — Planzeiten mit klarem Fallback statt „— — —“ */
export function formatWfmPlanTimeRange(
  plannedStart: string | null | undefined,
  plannedEnd: string | null | undefined,
  planStatus?: import('@/types/modules/wfmOfficeTimekeeping').WfmOfficePlanDisplayStatus,
): string {
  if (planStatus === 'no_planned_visit') return 'Kein geplanter Einsatz zugeordnet';
  if (planStatus === 'plan_missing' || (!plannedStart && !plannedEnd)) return 'Planzeit fehlt';
  return `${formatWfmTime(plannedStart)} – ${formatWfmTime(plannedEnd)}`;
}

/** ZEIT.3.1 — Ist-Zeiten mit klarem Fallback */
export function formatWfmActualTimeRange(
  actualStart: string | null | undefined,
  actualEnd: string | null | undefined,
  actualStatus?: import('@/types/modules/wfmOfficeTimekeeping').WfmOfficeActualDisplayStatus,
): string {
  if (actualStatus === 'not_captured' || (!actualStart && !actualEnd)) return 'Noch nicht erfasst';
  if (actualStatus === 'partial') {
    return `${formatWfmTime(actualStart)} – (offen)`;
  }
  return `${formatWfmTime(actualStart)} – ${formatWfmTime(actualEnd)}`;
}

/** Prüfqueue — Ist-Zeile mit Fallback auf Einsatz-Ist oder Plan */
export function formatWfmReviewQueueIstLabel(entry: WfmOfficeTimeEntry): string {
  const display = resolveWfmOfficeTimeDisplay(entry);
  if (display.hasTimeEntry) {
    return formatWfmActualTimeRange(display.actualStart, display.actualEnd, entry.actualDisplayStatus);
  }
  if (display.timeSource === 'assignment_actual') {
    return `${formatWfmTime(display.displayStart)} – ${formatWfmTime(display.displayEnd)} (aus Einsatz)`;
  }
  if (display.timeSource === 'assignment_planned') {
    return 'noch nicht gebucht';
  }
  return 'Noch nicht erfasst';
}

/** Prüfqueue — Dauer mit Fallback */
export function formatWfmReviewQueueDuration(entry: WfmOfficeTimeEntry): string {
  const display = resolveWfmOfficeTimeDisplay(entry);
  if (display.displayDurationMinutes > 0) {
    return formatWfmDurationMinutes(display.displayDurationMinutes);
  }
  return '—';
}

export function formatWfmReviewQueueStartLabel(
  entry: WfmOfficeTimeEntry,
  ampel: import('@/types/modules/wfmOfficeTimekeeping').WfmDeviationAmpel | null | undefined,
): string {
  if (ampel) {
    const labels = { green: 'Grün', yellow: 'Gelb', red: 'Rot', blue: 'Blau' };
    return `Start: ${labels[ampel]}`;
  }
  const display = resolveWfmOfficeTimeDisplay(entry);
  if (display.hasTimeEntry && display.actualStart) {
    return `Start: ${formatWfmTime(display.actualStart)}`;
  }
  if (display.timeSource === 'assignment_actual' && display.displayStart) {
    return `Start: ${formatWfmTime(display.displayStart)} (Einsatz)`;
  }
  if (display.displayStart) {
    return `Start geplant: ${formatWfmTime(display.displayStart)}`;
  }
  return 'Start: nicht erfasst';
}

export function formatWfmReviewQueueEndLabel(
  entry: WfmOfficeTimeEntry,
  ampel: import('@/types/modules/wfmOfficeTimekeeping').WfmDeviationAmpel | null | undefined,
): string {
  if (ampel) {
    const labels = { green: 'Grün', yellow: 'Gelb', red: 'Rot', blue: 'Blau' };
    return `Ende: ${labels[ampel]}`;
  }
  const display = resolveWfmOfficeTimeDisplay(entry);
  if (display.hasTimeEntry && display.actualEnd) {
    return `Ende: ${formatWfmTime(display.actualEnd)}`;
  }
  if (display.timeSource === 'assignment_actual' && display.displayEnd) {
    return `Ende: ${formatWfmTime(display.displayEnd)} (Einsatz)`;
  }
  if (display.displayEnd) {
    return `Ende geplant: ${formatWfmTime(display.displayEnd)}`;
  }
  return 'Ende: nicht erfasst';
}

export function formatWfmReviewQueueGesamtLabel(entry: WfmOfficeTimeEntry): string {
  const display = resolveWfmOfficeTimeDisplay(entry);
  if (entry.overallAmpel) {
    const labels = { green: 'Grün', yellow: 'Gelb', red: 'Rot', blue: 'Blau' };
    return `Gesamt (${labels[entry.overallAmpel]})`;
  }
  if (display.displayDurationMinutes > 0) {
    const prefix =
      display.timeSource === 'assignment_planned' ? 'Dauer geplant' : 'Gesamt';
    return `${prefix}: ${formatWfmDurationMinutes(display.displayDurationMinutes)}`;
  }
  return 'Gesamt: nicht berechnet';
}

export function formatWfmAmpelLabel(
  ampel: import('@/types/modules/wfmOfficeTimekeeping').WfmDeviationAmpel | null | undefined,
  kind: 'start' | 'end' | 'overall',
): string {
  if (!ampel) {
    if (kind === 'start') return 'Start: nicht erfasst';
    if (kind === 'end') return 'Ende: nicht erfasst';
    return 'Gesamt: —';
  }
  const labels = { green: 'Grün', yellow: 'Gelb', red: 'Rot', blue: 'Blau' };
  const prefix = kind === 'start' ? 'Start' : kind === 'end' ? 'Ende' : 'Gesamt';
  return `${prefix}: ${labels[ampel]}`;
}

export function formatWfmDurationMinutes(minutes: number): string {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Min.`;
  return `${h}:${String(m).padStart(2, '0')} h`;
}

export function formatWfmEventTypeLabel(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? eventType.replace(/_/g, ' ');
}

export function resolveWfmWorkTypeLabel(session: WfmWorkSession | null): string | null {
  if (!session) return null;
  if (session.displayStatus === 'im_einsatz') return 'Einsatz';
  if (session.displayStatus === 'buero') return 'Büro';
  if (session.displayStatus === 'homeoffice') return 'Home Office';
  if (session.displayStatus === 'unterwegs') return 'Fahrt';
  if (session.displayStatus === 'pause') return 'Pause';
  if (session.status === 'on_visit') return 'Einsatz';
  if (session.status === 'office') return 'Büro';
  if (session.status === 'homeoffice') return 'Home Office';
  if (session.status === 'driving') return 'Fahrt';
  if (session.status === 'paused') return 'Pause';
  const fromMode = WFM_WORK_TYPES.find((t) => t.workMode === session.workMode);
  return fromMode?.label ?? null;
}

function absenceStatusLabel(absenceType: WfmAbsenceType): string {
  if (absenceType === 'vacation') return 'Urlaub';
  if (absenceType === 'sick_leave' || absenceType === 'child_sick_leave') return 'Krank';
  return 'Abwesend';
}

export function isWfmAbsenceCoveringDate(absence: WfmAbsence, workDate: string): boolean {
  if (!['approved', 'active'].includes(absence.status)) return false;
  const dayStart = new Date(`${workDate}T00:00:00`);
  const dayEnd = new Date(`${workDate}T23:59:59.999`);
  const start = new Date(absence.startsAt);
  const end = new Date(absence.endsAt);
  return start <= dayEnd && end >= dayStart;
}

export function resolveTeamEmployeeStatusLabel(
  session: WfmWorkSession | null,
  absence: WfmAbsence | null,
): string {
  if (absence) return absenceStatusLabel(absence.absenceType);
  return formatWfmStatusLabel(session);
}

export function resolveLastEventSourceLabel(events: WfmTimeEvent[]): string | null {
  if (events.length === 0) return null;
  const last = events[events.length - 1];
  return WFM_EVENT_SOURCE_LABELS[last.source] ?? last.source;
}

export function buildTeamRowWarnings(
  session: WfmWorkSession | null,
  events: WfmTimeEvent[],
  ruleMessages: string[],
): string[] {
  const warnings: string[] = [...ruleMessages];

  if (!session) return warnings;

  if (session.isOnline && !session.endedAt && session.netMinutes >= 6 * 60 && session.pauseMinutes < 30) {
    warnings.push('Keine ausreichende Pause bei 6+ Stunden (ArbZG §4).');
  }

  if (session.isOnline && session.netMinutes >= 10 * 60) {
    warnings.push('Arbeitszeit über 10 Stunden — ArbZG-Hinweis.');
  }

  if (!session.isOnline && session.startedAt && !session.endedAt && session.status !== 'offline') {
    warnings.push('Arbeitszeit ohne Endzeit — bitte prüfen.');
  }

  const openPause = events.some((e) => e.eventType === 'pause_start')
    && !events.some((e) => e.eventType === 'pause_end');
  if (openPause && session.status !== 'paused') {
    warnings.push('Offene Pause ohne Fortsetzung.');
  }

  return [...new Set(warnings)];
}
