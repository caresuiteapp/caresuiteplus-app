import { useMemo } from 'react';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { addDays, eventsForDay, formatDayHeader, formatTime, parseDateKey, startOfDay, toDateKey } from '@/lib/office/calendarDateUtils';
import { groupCalendarEventsByDay, sortedCalendarEvents } from '@/lib/calendar/calendarWebViewModel';
import { formatCalendarEventTimeRange } from '@/lib/calendar/calendarEventDisplay';
import { OfficeCalendarEventChip } from '@/components/office/calendar/OfficeCalendarEventChip.web';
import { CalendarViewStyles } from './CalendarViewStyles.web';
type Props = { rangeStart?: Date; rangeEnd?: Date; events: CalendarEvent[]; onEventPress?: (event: CalendarEvent) => void };
export function CalendarAgendaList({ events, onEventPress, rangeStart, rangeEnd }: Props) {
  const groups = useMemo(() => {
    if (!rangeStart || !rangeEnd || !Number.isFinite(rangeStart.getTime()) || !Number.isFinite(rangeEnd.getTime()) || rangeEnd <= rangeStart) return groupCalendarEventsByDay(events);
    const sorted = sortedCalendarEvents(events);
    const result = new Map<string, CalendarEvent[]>();
    for (let day = startOfDay(rangeStart); day < rangeEnd; day = addDays(day, 1)) {
      const matches = eventsForDay(sorted, day);
      if (matches.length) result.set(toDateKey(day), matches);
    }
    return result;
  }, [events, rangeStart, rangeEnd]);
  return <section className="cs-calendar-view" aria-label="Kalenderagenda"><CalendarViewStyles />
    {groups.size ? <div className="cs-calendar-agenda">{[...groups].map(([key, dayEvents]) => <section key={key} className="cs-calendar-surface cs-calendar-agenda-group">
      <h2 className="cs-calendar-agenda-title">{formatDayHeader(parseDateKey(key))}</h2>
      <div className="cs-calendar-agenda-events">{dayEvents.map((event) => {
        const endKey = event.allDay ? event.end.slice(0, 10) : toDateKey(new Date(event.end));
        const dayStart = parseDateKey(key);
        const dayEnd = addDays(dayStart, 1);
        const hasRange = Boolean(rangeStart && rangeEnd);
        const continues = hasRange && !event.allDay && new Date(event.start) < dayStart;
        const time = hasRange && !event.allDay
          ? `${continues ? '00:00' : formatTime(event.start)} – ${new Date(event.end) >= dayEnd ? '24:00' : formatTime(event.end)}`
          : formatCalendarEventTimeRange(event);
        return <div key={event.id} className="cs-calendar-agenda-row"><div className="cs-calendar-agenda-time">{time}{continues && <span className="cs-calendar-agenda-end">Fortsetzung vom Vortag</span>}{endKey > key && <span className="cs-calendar-agenda-end">bis {parseDateKey(endKey).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</span>}</div><OfficeCalendarEventChip event={event} showTime={false} onEventPress={onEventPress} /></div>;
      })}</div>
    </section>)}</div> : <div className="cs-calendar-surface cs-calendar-empty"><strong>Keine Einträge in diesem Zeitraum</strong>Wähle einen anderen Zeitraum oder passe die Filter an.</div>}
  </section>;
}
