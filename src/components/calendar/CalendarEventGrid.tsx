import type { CalendarEvent, CalendarViewMode } from '@/types/modules/calendarEvent';
import { CalendarAgendaList } from './CalendarAgendaList';
import { CalendarListView } from './CalendarListView';
import { CalendarTimelineView } from './CalendarTimelineView';
import { OfficeCalendarDayView } from '@/components/office/calendar/OfficeCalendarDayView';
import { OfficeCalendarMonthView } from '@/components/office/calendar/OfficeCalendarMonthView';
import { OfficeCalendarWeekView } from '@/components/office/calendar/OfficeCalendarWeekView';
import { OfficeCalendarYearView } from '@/components/office/calendar/OfficeCalendarYearView';
import { startOfMonth } from '@/lib/office/calendarDateUtils';

type CalendarEventGridProps = {
  viewMode: CalendarViewMode;
  anchor: Date;
  events: CalendarEvent[];
  weekStartDay: number;
  maxCollapsedEvents: number;
  dayViewStartHour: number;
  weekFullDay: boolean;
  onEventPress?: (event: CalendarEvent) => void;
  onSelectMonth?: (monthIndex: number) => void;
};

export function CalendarEventGrid({
  viewMode,
  anchor,
  events,
  weekStartDay,
  maxCollapsedEvents,
  dayViewStartHour,
  weekFullDay,
  onEventPress,
  onSelectMonth,
}: CalendarEventGridProps) {
  if (viewMode === 'day') {
    return (
      <OfficeCalendarDayView
        anchor={anchor}
        events={events}
        dayViewStartHour={dayViewStartHour}
        onEventPress={onEventPress}
      />
    );
  }

  if (viewMode === 'week') {
    return (
      <OfficeCalendarWeekView
        anchor={anchor}
        events={events}
        weekStartDay={weekStartDay}
        weekFullDay={weekFullDay}
        dayViewStartHour={dayViewStartHour}
        onEventPress={onEventPress}
      />
    );
  }

  if (viewMode === 'month') {
    return (
      <OfficeCalendarMonthView
        anchor={anchor}
        events={events}
        weekStartDay={weekStartDay}
        maxCollapsedEvents={maxCollapsedEvents}
        onEventPress={onEventPress}
      />
    );
  }

  if (viewMode === 'year') {
    return (
      <OfficeCalendarYearView
        anchor={anchor}
        events={events}
        onSelectMonth={(monthIndex) => {
          onSelectMonth?.(monthIndex);
        }}
      />
    );
  }

  if (viewMode === 'agenda') {
    return <CalendarAgendaList events={events} onEventPress={onEventPress} />;
  }

  if (viewMode === 'list') {
    return <CalendarListView events={events} onEventPress={onEventPress} />;
  }

  return (
    <CalendarTimelineView
      events={events}
      anchor={anchor}
      onEventPress={onEventPress}
    />
  );
}

export { startOfMonth };
