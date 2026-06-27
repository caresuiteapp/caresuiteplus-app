import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { formatTime } from '@/lib/office/calendarDateUtils';

export type CalendarEventDisplay = {
  clientName: string | null;
  employeeName: string | null;
  serviceTitle: string | null;
  timeRange: string | null;
  /** Primary headline — client name for Einsätze, otherwise event title. */
  primaryLine: string;
  isAssignment: boolean;
};

const TITLE_SEPARATOR = ' · ';

/** Parses legacy titles like „Service · Klient:in“. */
export function parseLegacyAssignmentTitle(title: string): {
  serviceTitle: string;
  clientName: string | null;
} {
  const parts = title.split(TITLE_SEPARATOR).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      serviceTitle: parts[0] ?? title,
      clientName: parts[parts.length - 1] ?? null,
    };
  }
  return { serviceTitle: title, clientName: null };
}

export function isAssignmentCalendarEvent(event: CalendarEvent): boolean {
  return event.type === 'einsatz' || event.sourceType === 'assist_visit';
}

export function formatCalendarEventTimeRange(event: CalendarEvent): string | null {
  if (event.allDay) return 'Ganztägig';
  return `${formatTime(event.start)} – ${formatTime(event.end)}`;
}

export function resolveCalendarEventDisplay(event: CalendarEvent): CalendarEventDisplay {
  const isAssignment = isAssignmentCalendarEvent(event);
  const timeRange = formatCalendarEventTimeRange(event);

  if (!isAssignment) {
    return {
      clientName: null,
      employeeName: null,
      serviceTitle: null,
      timeRange,
      primaryLine: event.title,
      isAssignment: false,
    };
  }

  const parsed = parseLegacyAssignmentTitle(event.title);
  const clientName = event.clientName?.trim() || parsed.clientName;
  const employeeName = event.employeeName?.trim() || null;
  const serviceTitle = event.serviceTitle?.trim() || parsed.serviceTitle || event.title;

  return {
    clientName,
    employeeName,
    serviceTitle: serviceTitle !== clientName ? serviceTitle : null,
    timeRange,
    primaryLine: clientName ?? event.title,
    isAssignment: true,
  };
}

export function formatCalendarEventCompactLabel(
  event: CalendarEvent,
  options?: { includeTime?: boolean },
): string {
  const display = resolveCalendarEventDisplay(event);
  const includeTime = options?.includeTime ?? true;

  if (!display.isAssignment) {
    if (includeTime && display.timeRange) {
      return `${display.primaryLine} · ${display.timeRange}`;
    }
    return display.primaryLine;
  }

  const segments = [display.clientName ?? display.primaryLine];
  if (includeTime && display.timeRange) segments.push(display.timeRange);
  if (display.employeeName) segments.push(display.employeeName);
  return segments.filter(Boolean).join(' · ');
}

export function enrichCalendarEventWithAssignment(
  event: CalendarEvent,
  assignment: {
    clientName: string;
    employeeName: string;
    title: string;
    serviceName?: string | null;
  },
): CalendarEvent {
  if (!isAssignmentCalendarEvent(event)) return event;

  const parsed = parseLegacyAssignmentTitle(event.title);

  return {
    ...event,
    clientName: event.clientName?.trim() || assignment.clientName,
    employeeName: event.employeeName?.trim() || assignment.employeeName,
    serviceTitle:
      event.serviceTitle?.trim()
      || assignment.serviceName?.trim()
      || parsed.serviceTitle
      || assignment.title,
  };
}
