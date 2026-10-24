// Generated native presentation from src/components/calendar/CalendarAgendaList.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeDiv,NativeH2,NativeSpan,NativeStrong} from '@/components/layout/NativeWorkspaceElements.native';
import { useMemo } from 'react';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { addDays, eventsForDay, formatDayHeader, formatTime, parseDateKey, startOfDay, toDateKey } from '@/lib/office/calendarDateUtils';
import { groupCalendarEventsByDay, sortedCalendarEvents } from '@/lib/calendar/calendarWebViewModel';
import { formatCalendarEventTimeRange } from '@/lib/calendar/calendarEventDisplay';
import { OfficeCalendarEventChip } from "../office/calendar/OfficeCalendarEventChip.native.tsx";
import { CalendarViewStyles } from "./CalendarViewStyles.native.tsx";
type Props = {
    rangeStart?: Date;
    rangeEnd?: Date;
    events: CalendarEvent[];
    onEventPress?: (event: CalendarEvent) => void;
};
export function CalendarAgendaList({ events, onEventPress, rangeStart, rangeEnd }: Props) {
    const groups = useMemo(() => {
        if (!rangeStart || !rangeEnd || !Number.isFinite(rangeStart.getTime()) || !Number.isFinite(rangeEnd.getTime()) || rangeEnd <= rangeStart)
            return groupCalendarEventsByDay(events);
        const sorted = sortedCalendarEvents(events);
        const result = new Map<string, CalendarEvent[]>();
        for (let day = startOfDay(rangeStart); day < rangeEnd; day = addDays(day, 1)) {
            const matches = eventsForDay(sorted, day);
            if (matches.length)
                result.set(toDateKey(day), matches);
        }
        return result;
    }, [events, rangeStart, rangeEnd]);
    return <NativeSection className="cs-calendar-view" aria-label="Kalenderagenda"><CalendarViewStyles />
    {groups.size ? <NativeDiv className="cs-calendar-agenda">{[...groups].map(([key, dayEvents]) => <NativeSection key={key} className="cs-calendar-surface cs-calendar-agenda-group">
      <NativeH2 className="cs-calendar-agenda-title">{formatDayHeader(parseDateKey(key))}</NativeH2>
      <NativeDiv className="cs-calendar-agenda-events">{dayEvents.map((event) => {
                    const endKey = event.allDay ? event.end.slice(0, 10) : toDateKey(new Date(event.end));
                    const dayStart = parseDateKey(key);
                    const dayEnd = addDays(dayStart, 1);
                    const hasRange = Boolean(rangeStart && rangeEnd);
                    const continues = hasRange && !event.allDay && new Date(event.start) < dayStart;
                    const time = hasRange && !event.allDay
                        ? `${continues ? '00:00' : formatTime(event.start)} – ${new Date(event.end) >= dayEnd ? '24:00' : formatTime(event.end)}`
                        : formatCalendarEventTimeRange(event);
                    return <NativeDiv key={event.id} className="cs-calendar-agenda-row"><NativeDiv className="cs-calendar-agenda-time">{time}{continues && <NativeSpan className="cs-calendar-agenda-end">Fortsetzung vom Vortag</NativeSpan>}{endKey > key && <NativeSpan className="cs-calendar-agenda-end">bis {parseDateKey(endKey).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</NativeSpan>}</NativeDiv><OfficeCalendarEventChip event={event} showTime={false} onEventPress={onEventPress}/></NativeDiv>;
                })}</NativeDiv>
    </NativeSection>)}</NativeDiv> : <NativeDiv className="cs-calendar-surface cs-calendar-empty"><NativeStrong>Keine Einträge in diesem Zeitraum</NativeStrong>Wähle einen anderen Zeitraum oder passe die Filter an.</NativeDiv>}
  </NativeSection>;
}
