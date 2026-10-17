import { useMemo } from 'react';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { CALENDAR_EVENT_TYPE_LABELS } from '@/types/modules/calendarEvent';
import { calendarEventDateKey, sortedCalendarEvents } from '@/lib/calendar/calendarWebViewModel';
import { parseDateKey, toDateKey } from '@/lib/office/calendarDateUtils';
import { formatCalendarEventTimeRange } from '@/lib/calendar/calendarEventDisplay';
import { OfficeCalendarEventChip } from '@/components/office/calendar/OfficeCalendarEventChip.web';
import { CalendarViewStyles } from './CalendarViewStyles.web';
type Props = { events: CalendarEvent[]; onEventPress?: (event: CalendarEvent) => void };
function eventLastDateKey(event: CalendarEvent): string {
  if (event.allDay) return event.end.slice(0, 10);
  const end = Date.parse(event.end);
  const start = Date.parse(event.start);
  return toDateKey(new Date(end > start ? end - 1 : end));
}
const moduleLabels: Record<string, string> = { office: 'Office', assist: 'Assist', pflege: 'Pflege', stationaer: 'Stationär', beratung: 'Beratung', akademie: 'Akademie', all: 'Übergreifend' };
export function CalendarListView({ events, onEventPress }: Props) {
  const sorted = useMemo(() => sortedCalendarEvents(events), [events]);
  return <section className="cs-calendar-view" aria-label="Kalenderliste"><CalendarViewStyles /><div className="cs-calendar-surface">
    <header className="cs-calendar-view-heading"><h2>Alle Einträge</h2><p>{sorted.length} {sorted.length === 1 ? 'Eintrag' : 'Einträge'} im gewählten Zeitraum</p></header>
    {sorted.length ? <><p className="cs-calendar-scroll-hint">Die Tabelle lässt sich seitlich scrollen.</p><div className="cs-calendar-scroll" tabIndex={0} role="region" aria-label="Eintragsliste, seitlich scrollbar"><table className="cs-calendar-list-table">
      <colgroup><col style={{ width: 116 }} /><col style={{ width: 128 }} /><col /><col style={{ width: 132 }} /><col style={{ width: 106 }} /></colgroup>
      <thead><tr><th scope="col">Datum</th><th scope="col">Uhrzeit</th><th scope="col">Eintrag · Person</th><th scope="col">Art</th><th scope="col">Bereich</th></tr></thead>
      <tbody>{sorted.map((event) => <tr key={event.id}><td>{parseDateKey(calendarEventDateKey(event)).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}{eventLastDateKey(event) > calendarEventDateKey(event) && <span className="cs-calendar-agenda-end">bis {parseDateKey(eventLastDateKey(event)).toLocaleDateString('de-DE')}</span>}</td><td>{formatCalendarEventTimeRange(event)}</td><td><OfficeCalendarEventChip event={event} showTime={false} onEventPress={onEventPress} /></td><td><span className="cs-calendar-list-type">{CALENDAR_EVENT_TYPE_LABELS[event.type] ?? event.type}</span></td><td>{moduleLabels[event.moduleKey ?? ''] ?? 'Übergreifend'}</td></tr>)}</tbody>
    </table></div></> : <div className="cs-calendar-empty"><strong>Keine Einträge in diesem Zeitraum</strong>Wähle einen anderen Zeitraum oder passe die Filter an.</div>}
  </div></section>;
}
