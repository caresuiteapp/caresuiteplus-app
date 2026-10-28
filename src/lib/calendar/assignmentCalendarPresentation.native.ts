// Generated native presentation from src/lib/calendar/assignmentCalendarPresentation.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { ASSIGNMENT_CALENDAR_VISUALS as BASE_VISUALS, resolveAssignmentCalendarVisual as resolveBaseVisual, type AssignmentCalendarState, type AssignmentCalendarVisual, } from './assignmentCalendarStatus';
export type { AssignmentCalendarState, AssignmentCalendarVisual } from './assignmentCalendarStatus';
export const ASSIGNMENT_CALENDAR_VISUALS: Record<AssignmentCalendarState, AssignmentCalendarVisual> = {
    ...BASE_VISUALS,
    scheduled: { ...BASE_VISUALS.scheduled, label: 'Geplant / bestätigt' },
    open: { ...BASE_VISUALS.open, label: 'Nacharbeit offen' },
};
/** Open required tasks are normal before and during a visit, not follow-up. */
export function resolveAssignmentCalendarVisual(event: CalendarEvent, now = new Date()): AssignmentCalendarVisual | null {
    const phase = resolveBaseVisual(event.isIncomplete ? { ...event, isIncomplete: false } : event, now);
    if (!phase)
        return null;
    // Preserve explicit follow-up and terminal/risk states. An overdue incomplete
    // visit still needs follow-up, while future planning and active visits do not.
    const visual = event.isIncomplete && phase.state !== 'scheduled' && phase.state !== 'active'
        ? resolveBaseVisual(event, now)!
        : phase;
    return visual.state === 'scheduled' || visual.state === 'open'
        ? ASSIGNMENT_CALENDAR_VISUALS[visual.state]
        : visual;
}
