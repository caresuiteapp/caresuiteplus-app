import { useEffect, useMemo, useRef } from 'react';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { eventsForDay, isSameDay, toDateKey } from '@/lib/office/calendarDateUtils';
import { buildTimedDayLayout, sortedCalendarEvents } from '@/lib/calendar/calendarWebViewModel';
import { assignmentProfileClickCount, useAssignmentProfileDateSelection } from './AssignmentProfileDateSelection';
import type { AssignmentProfileDropHandler } from './OfficeAssignmentProfileCalendarPlanner';
import { CalendarViewStyles } from './CalendarViewStyles.web';
import { OfficeCalendarEventChip } from '@/components/office/calendar/OfficeCalendarEventChip.web';

type Props = { title: string; days: Date[]; events: CalendarEvent[]; startHour: number; endHour: number; scrollHour: number; onEventPress?: (event: CalendarEvent) => void; selectedAssignmentProfileId?: string | null; onAssignmentProfileDrop?: AssignmentProfileDropHandler };
const HOUR_HEIGHT = 76;
export function CalendarTimeGrid({ title, days, events, startHour, endHour, scrollHour, onEventPress, selectedAssignmentProfileId, onAssignmentProfileDrop }: Props) {
  const selection = useAssignmentProfileDateSelection();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dateKey = days.map(toDateKey).join(',');
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const sorted = useMemo(() => sortedCalendarEvents(events), [events]);
  const data = useMemo(() => days.map((day) => {
    const items = eventsForDay(sorted, day);
    const timed = buildTimedDayLayout(items, day, { startHour, endHour, hourHeight: HOUR_HEIGHT, minHeight: 28 });
    const ids = new Set(timed.map(({ event }) => event.id));
    return { day, allDay: items.filter((event) => event.allDay), timed, outside: items.filter((event) => !event.allDay && !ids.has(event.id)) };
  }), [dateKey, sorted, startHour, endHour]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, Math.min(endHour - startHour - 1, scrollHour - startHour)) * HOUR_HEIGHT; }, [dateKey, scrollHour, startHour, endHour]);
  const selectable = Boolean(selection || (selectedAssignmentProfileId && onAssignmentProfileDrop));
  const today = new Date();
  // Give concurrent entries real lanes instead of shrinking their text into
  // unreadable strips. Only the calendar itself scrolls in a narrow workspace.
  const columnWidths = data.map(({ timed }) => Math.max(days.length === 1 ? 276 : 148, ...timed.map(({ columnCount }) => columnCount * 104)));
  const gridStyle = { gridTemplateColumns: `64px ${columnWidths.map((width) => `minmax(${width}px, 1fr)`).join(' ')}` };
  const outside = data.flatMap(({ day, outside: items }) => items.map((event) => ({ day, event })));
  const dateLabel = (day: Date) => day.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const select = (day: Date, clickCount: number, time?: string) => {
    if (selection && !selection.disabled) selection.selectDate(day, clickCount, time);
    else if (!selection && selectedAssignmentProfileId) onAssignmentProfileDrop?.(selectedAssignmentProfileId, day, time);
  };
  return <section className="cs-calendar-view" aria-label={days.length === 1 ? 'Tageskalender' : 'Wochenkalender'}>
    <CalendarViewStyles />
    <div className="cs-calendar-surface">
      <header className="cs-calendar-view-heading"><h2>{title}</h2><p>{String(startHour).padStart(2, '0')}:00–{String(endHour).padStart(2, '0')}:00 Uhr</p></header>
      {days.length > 1 && <p className="cs-calendar-scroll-hint">Für alle Wochentage seitlich scrollen. Gleichzeitige Einträge stehen nebeneinander.</p>}
      <div className="cs-calendar-scroll" tabIndex={0} role="region" aria-label="Zeitkalender, scrollbar">
        <div className="cs-calendar-timeline" data-day={days.length === 1} style={{ minWidth: 80 + columnWidths.reduce((sum, width) => sum + width, 0) }}>
          <div className="cs-calendar-time-header" style={gridStyle}><div className="cs-calendar-time-heading" aria-hidden="true" />{days.map((day) => {
            const selected = selection?.selectedDateKeys.includes(toDateKey(day)) ?? false;
            const content = <><span>{day.toLocaleDateString('de-DE', { weekday: 'short', month: 'short' })}</span><strong>{day.getDate()}{selected ? ' ✓' : ''}</strong></>;
            const props = { className: 'cs-calendar-time-heading', 'data-today': isSameDay(day, today), 'data-selected': selected };
            return selectable ? <button key={toDateKey(day)} type="button" {...props} disabled={selection?.disabled} aria-label={`${dateLabel(day)}, ${selected ? 'für das Einsatzprofil ausgewählt' : 'für das Einsatzprofil auswählen'}`} aria-pressed={selected} onClick={(event) => select(day, assignmentProfileClickCount(event))}>{content}</button> : <div key={toDateKey(day)} {...props}>{content}</div>;
          })}</div>
          {data.some(({ allDay }) => allDay.length) && <div className="cs-calendar-allday" style={gridStyle}><div className="cs-calendar-allday-title">Ganztägig</div>{data.map(({ day, allDay }) => <div className="cs-calendar-allday-cell" key={toDateKey(day)}>{allDay.map((event) => <OfficeCalendarEventChip key={event.id} event={event} compact showTime={false} onEventPress={onEventPress} />)}</div>)}</div>}
          <div className="cs-calendar-time-scroll" ref={scrollRef} tabIndex={0} role="region" aria-label="Stundenraster, nach oben und unten scrollbar">
            <div className="cs-calendar-time-body" style={gridStyle}>
              <div className="cs-calendar-time-gutter">{hours.map((hour) => <div key={hour} className="cs-calendar-hour-label" style={{ height: HOUR_HEIGHT }}>{String(hour).padStart(2, '0')}:00</div>)}</div>
              {data.map(({ day, timed }) => {
                const key = toDateKey(day);
                const selected = selection?.selectedDateKeys.includes(key) ?? false;
                return <div key={key} className="cs-calendar-time-day" data-cs-assignment-drop-date={onAssignmentProfileDrop ? key : undefined} data-cs-assignment-drop-time="" data-today={isSameDay(day, today)} data-selected={selected} style={{ height: hours.length * HOUR_HEIGHT }}>
                  {hours.map((hour) => {
                    const time = `${String(hour).padStart(2, '0')}:00`;
                    const props = { className: 'cs-calendar-time-slot', style: { height: HOUR_HEIGHT }, 'data-cs-assignment-drop-date': onAssignmentProfileDrop ? key : undefined, 'data-cs-assignment-drop-time': time };
                    return selectable ? <button type="button" key={hour} {...props} disabled={selection?.disabled} aria-label={`${dateLabel(day)}, Zeitvorschlag ${time} Uhr`} aria-pressed={selected} onClick={(event) => select(day, assignmentProfileClickCount(event), time)} /> : <div key={hour} {...props} />;
                  })}
                  {timed.map(({ event, top, height, column, columnCount, continuesBefore, continuesAfter }) => <div key={event.id} className="cs-calendar-timed-block" data-short={height < 76} data-tiny={height < 46} style={{ top, height, left: `${column / columnCount * 100}%`, width: `${100 / columnCount}%` }}>
                    <OfficeCalendarEventChip event={event} compact={days.length > 1 || height < 120} onEventPress={onEventPress} />
                    {(continuesBefore || continuesAfter) && <span className="cs-calendar-visually-hidden">{continuesBefore ? 'Beginnt vor diesem Zeitfenster. ' : ''}{continuesAfter ? 'Endet nach diesem Zeitfenster.' : ''}</span>}
                  </div>)}
                </div>;
              })}
            </div>
          </div>
        </div>
      </div>
      {outside.length > 0 && <details className="cs-calendar-time-overflow"><summary>{outside.length} {outside.length === 1 ? 'Eintrag liegt' : 'Einträge liegen'} außerhalb von {String(startHour).padStart(2, '0')}:00–{String(endHour).padStart(2, '0')}:00 Uhr</summary><div className="cs-calendar-time-overflow-list">{outside.map(({ day, event }) => <div key={`${toDateKey(day)}-${event.id}`}><span className="cs-calendar-time-edge">{day.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}</span><OfficeCalendarEventChip event={event} onEventPress={onEventPress} /></div>)}</div></details>}
    </div>
  </section>;
}
