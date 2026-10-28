// Generated native presentation from src/components/calendar/CalendarEventLabel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSpan} from '@/components/layout/NativeWorkspaceElements.native';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { isCancelledCalendarEvent, resolveCalendarEventDisplay } from '@/lib/calendar/calendarEventDisplay';
import { resolveAssignmentCalendarVisual } from "../../lib/calendar/assignmentCalendarPresentation.native.ts";
import { ASSIGNMENT_CALENDAR_COLORS } from "../../lib/calendar/calendarEventColors.native.ts";
import { calendarEventEmployeeIds } from '@/lib/calendar/calendarParticipants';
export type CalendarEventLabelVariant = 'stacked' | 'compact' | 'inline';
type Props = {
    event: CalendarEvent;
    variant?: CalendarEventLabelVariant;
    showTime?: boolean;
    showService?: boolean;
    numberOfLines?: number;
};
export function calendarEventAccessibleLabel(event: CalendarEvent): string {
    const display = resolveCalendarEventDisplay(event);
    const visual = resolveAssignmentCalendarVisual(event);
    const participants = calendarEventEmployeeIds(event);
    return [display.timeRange, display.primaryLine, display.employeeName || (participants.length > 1 ? event.employeeName || `${participants.length} Mitarbeitende` : null), display.serviceTitle, visual?.label].filter(Boolean).join(' · ');
}
export function CalendarEventLabel({ event, variant = 'stacked', showTime = true, showService = true }: Props) {
    const display = resolveCalendarEventDisplay(event);
    const visual = resolveAssignmentCalendarVisual(event);
    const participants = calendarEventEmployeeIds(event);
    const employeeLabel = !display.isAssignment && participants.length > 1 ? `${participants.length} Mitarbeitende` : display.employeeName;
    return <NativeSpan className="cs-calendar-event-label" data-variant={variant} data-cancelled={isCancelledCalendarEvent(event)}>
    {(showTime || visual) && <NativeSpan className="cs-calendar-event-meta">
      {showTime && display.timeRange && <NativeSpan className="cs-calendar-event-time">{display.timeRange}</NativeSpan>}
      {visual && <NativeSpan className="cs-calendar-event-status" style={{ backgroundColor: ASSIGNMENT_CALENDAR_COLORS[visual.state].accent }}><NativeSpan className="cs-calendar-event-status-symbol" aria-hidden="true">{visual.symbol}</NativeSpan>{visual.label}</NativeSpan>}
    </NativeSpan>}
    <NativeSpan className="cs-calendar-event-primary">{display.primaryLine}</NativeSpan>
    {employeeLabel && <NativeSpan className="cs-calendar-event-person" title={event.employeeName}>{employeeLabel}</NativeSpan>}
    {showService && display.serviceTitle && display.serviceTitle !== display.primaryLine && <NativeSpan className="cs-calendar-event-service">{display.serviceTitle}</NativeSpan>}
  </NativeSpan>;
}
