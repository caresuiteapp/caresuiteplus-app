import type { CSSProperties } from 'react';
import { useRouter } from 'expo-router';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { CalendarEventLabel, calendarEventAccessibleLabel } from '@/components/calendar/CalendarEventLabel.web';
import { isCancelledCalendarEvent } from '@/lib/calendar/calendarEventDisplay';
import { resolveAssignmentCalendarVisual } from '@/lib/calendar/assignmentCalendarStatus';

type Props = { event: CalendarEvent; compact?: boolean; showTime?: boolean; onEventPress?: (event: CalendarEvent) => void };
export function OfficeCalendarEventChip({ event, compact = false, showTime = true, onEventPress }: Props) {
  const router = useRouter();
  const visual = resolveAssignmentCalendarVisual(event);
  const label = calendarEventAccessibleLabel(event);
  const props = {
    className: 'cs-calendar-event', 'data-calendar-event-id': event.id, 'data-compact': compact, 'data-cancelled': isCancelledCalendarEvent(event),
    style: { '--event-accent': visual?.color ?? event.color } as CSSProperties,
    title: label, 'aria-label': label,
  };
  const content = <CalendarEventLabel event={event} variant={compact ? 'compact' : 'stacked'} showTime={showTime} showService={!compact} />;
  if (onEventPress) return <button type="button" {...props} onClick={(press) => { press.stopPropagation(); onEventPress(event); }}>{content}</button>;
  if (event.href) return <a {...props} href={event.href} onClick={(press) => {
    press.stopPropagation();
    if (!press.metaKey && !press.ctrlKey && !press.shiftKey && !press.altKey && press.button === 0) { press.preventDefault(); router.push(event.href as never); }
  }}>{content}</a>;
  return <div {...props}>{content}</div>;
}
