// Generated native presentation from src/components/calendar/CalendarListView.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeDiv,NativeHeader,NativeH2,NativeP,NativeTable,NativeColgroup,NativeCol,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeSpan,NativeStrong} from '@/components/layout/NativeWorkspaceElements.native';
import { useMemo } from 'react';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { CALENDAR_EVENT_TYPE_LABELS } from '@/types/modules/calendarEvent';
import { calendarEventDateKey, sortedCalendarEvents } from '@/lib/calendar/calendarWebViewModel';
import { parseDateKey, toDateKey } from '@/lib/office/calendarDateUtils';
import { formatCalendarEventTimeRange } from '@/lib/calendar/calendarEventDisplay';
import { OfficeCalendarEventChip } from "../office/calendar/OfficeCalendarEventChip.native.tsx";
import { CalendarViewStyles } from "./CalendarViewStyles.native.tsx";
type Props = {
    events: CalendarEvent[];
    onEventPress?: (event: CalendarEvent) => void;
};
function eventLastDateKey(event: CalendarEvent): string {
    if (event.allDay)
        return event.end.slice(0, 10);
    const end = Date.parse(event.end);
    const start = Date.parse(event.start);
    return toDateKey(new Date(end > start ? end - 1 : end));
}
const moduleLabels: Record<string, string> = { office: 'Office', assist: 'Assist', pflege: 'Pflege', stationaer: 'Stationär', beratung: 'Beratung', akademie: 'Akademie', all: 'Übergreifend' };
export function CalendarListView({ events, onEventPress }: Props) {
    const sorted = useMemo(() => sortedCalendarEvents(events), [events]);
    return <NativeSection className="cs-calendar-view" aria-label="Kalenderliste"><CalendarViewStyles /><NativeDiv className="cs-calendar-surface">
    <NativeHeader className="cs-calendar-view-heading"><NativeH2>Alle Einträge</NativeH2><NativeP>{sorted.length} {sorted.length === 1 ? 'Eintrag' : 'Einträge'} im gewählten Zeitraum</NativeP></NativeHeader>
    {sorted.length ? <><NativeP className="cs-calendar-scroll-hint">Die Tabelle lässt sich seitlich scrollen.</NativeP><NativeDiv className="cs-calendar-scroll" tabIndex={0} role="region" aria-label="Eintragsliste, seitlich scrollbar"><NativeTable className="cs-calendar-list-table">
      <NativeColgroup><NativeCol style={{ width: 116 }}/><NativeCol style={{ width: 128 }}/><NativeCol /><NativeCol style={{ width: 132 }}/><NativeCol style={{ width: 106 }}/></NativeColgroup>
      <NativeThead><NativeTr><NativeTh scope="col">Datum</NativeTh><NativeTh scope="col">Uhrzeit</NativeTh><NativeTh scope="col">Eintrag · Person</NativeTh><NativeTh scope="col">Art</NativeTh><NativeTh scope="col">Bereich</NativeTh></NativeTr></NativeThead>
      <NativeTbody>{sorted.map((event) => <NativeTr key={event.id}><NativeTd>{parseDateKey(calendarEventDateKey(event)).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}{eventLastDateKey(event) > calendarEventDateKey(event) && <NativeSpan className="cs-calendar-agenda-end">bis {parseDateKey(eventLastDateKey(event)).toLocaleDateString('de-DE')}</NativeSpan>}</NativeTd><NativeTd>{formatCalendarEventTimeRange(event)}</NativeTd><NativeTd><OfficeCalendarEventChip event={event} showTime={false} onEventPress={onEventPress}/></NativeTd><NativeTd><NativeSpan className="cs-calendar-list-type">{CALENDAR_EVENT_TYPE_LABELS[event.type] ?? event.type}</NativeSpan></NativeTd><NativeTd>{moduleLabels[event.moduleKey ?? ''] ?? 'Übergreifend'}</NativeTd></NativeTr>)}</NativeTbody>
    </NativeTable></NativeDiv></> : <NativeDiv className="cs-calendar-empty"><NativeStrong>Keine Einträge in diesem Zeitraum</NativeStrong>Wähle einen anderen Zeitraum oder passe die Filter an.</NativeDiv>}
  </NativeDiv></NativeSection>;
}
