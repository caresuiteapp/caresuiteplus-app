import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { isCancelledCalendarEvent, resolveCalendarEventDisplay } from '@/lib/calendar/calendarEventDisplay';
import { resolveAssignmentCalendarVisual } from '@/lib/calendar/assignmentCalendarStatus';
import { ASSIGNMENT_CALENDAR_COLORS } from '@/lib/calendar/calendarEventColors.web';

export type CalendarEventLabelVariant = 'stacked' | 'compact' | 'inline';
type Props = { event: CalendarEvent; variant?: CalendarEventLabelVariant; showTime?: boolean; showService?: boolean; numberOfLines?: number };

export function calendarEventAccessibleLabel(event: CalendarEvent): string {
  const display = resolveCalendarEventDisplay(event);
  const visual = resolveAssignmentCalendarVisual(event);
  return [display.timeRange, display.primaryLine, display.employeeName, display.serviceTitle, visual?.label].filter(Boolean).join(' · ');
}

export function CalendarEventLabel({ event, variant = 'stacked', showTime = true, showService = true }: Props) {
  const display = resolveCalendarEventDisplay(event);
  const visual = resolveAssignmentCalendarVisual(event);
  return <span className="cs-calendar-event-label" data-variant={variant} data-cancelled={isCancelledCalendarEvent(event)}>
    {(showTime || visual) && <span className="cs-calendar-event-meta">
      {showTime && display.timeRange && <span className="cs-calendar-event-time">{display.timeRange}</span>}
      {visual && <span className="cs-calendar-event-status" style={{ backgroundColor: ASSIGNMENT_CALENDAR_COLORS[visual.state].accent }}><span className="cs-calendar-event-status-symbol" aria-hidden="true">{visual.symbol}</span>{visual.label}</span>}
    </span>}
    <span className="cs-calendar-event-primary">{display.primaryLine}</span>
    {display.employeeName && <span className="cs-calendar-event-person">{display.employeeName}</span>}
    {showService && display.serviceTitle && display.serviceTitle !== display.primaryLine && <span className="cs-calendar-event-service">{display.serviceTitle}</span>}
  </span>;
}
