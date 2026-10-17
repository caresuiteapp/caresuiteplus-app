import { useMemo, useState } from 'react';
import type { CalendarEvent, WeekStartDay } from '@/types/modules/calendarEvent';
import { eventsForDay, formatMonthYear, getMonthGridDays, isSameDay, orderedWeekdayLabels, toDateKey } from '@/lib/office/calendarDateUtils';
import { sortedCalendarEvents } from '@/lib/calendar/calendarWebViewModel';
import { intervalText, type DayPlanability } from '@/lib/calendar/employeeMonthPlanning';
import { assignmentProfileClickCount, useAssignmentProfileDateSelection } from '@/components/calendar/AssignmentProfileDateSelection';
import type { AssignmentProfileDropHandler } from '@/components/calendar/OfficeAssignmentProfileCalendarPlanner';
import { CalendarViewStyles } from '@/components/calendar/CalendarViewStyles.web';
import { OfficeCalendarEventChip } from './OfficeCalendarEventChip.web';

type Props = { anchor: Date; events: CalendarEvent[]; weekStartDay: WeekStartDay; maxCollapsedEvents: number; onEventPress?: (event: CalendarEvent) => void; selectedAssignmentProfileId?: string | null; onAssignmentProfileDrop?: AssignmentProfileDropHandler; planabilityByDay?: Record<string, DayPlanability>; onSelectDate?: (date: Date) => void };
export function OfficeCalendarMonthView({ anchor, events, weekStartDay, maxCollapsedEvents, onEventPress, selectedAssignmentProfileId, onAssignmentProfileDrop, planabilityByDay, onSelectDate }: Props) {
  const selection = useAssignmentProfileDateSelection();
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set());
  const days = useMemo(() => getMonthGridDays(anchor, weekStartDay), [anchor, weekStartDay]);
  const sorted = useMemo(() => sortedCalendarEvents(events), [events]);
  const limit = Math.max(1, Math.floor(maxCollapsedEvents) || 3);
  const toggleDay = (key: string) => setExpandedDays((previous) => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const today = new Date();
  const selectable = Boolean(selection || (selectedAssignmentProfileId && onAssignmentProfileDrop) || onSelectDate);
  return <section className="cs-calendar-view" aria-label="Monatskalender">
    <CalendarViewStyles />
    <div className="cs-calendar-surface">
      <header className="cs-calendar-view-heading"><h2>{formatMonthYear(anchor)}</h2><p>{events.length} {events.length === 1 ? 'Eintrag' : 'Einträge'} im angezeigten Zeitraum</p></header>
      <p className="cs-calendar-scroll-hint">Für alle Wochentage seitlich scrollen. Einträge öffnen die Details.</p>
      <div className="cs-calendar-scroll" tabIndex={0} role="region" aria-label="Monatsraster, seitlich scrollbar">
        <div className="cs-calendar-month-grid">
          {orderedWeekdayLabels(weekStartDay).map((label) => <div className="cs-calendar-weekday" key={label}>{label}</div>)}
          {days.map(({ date, inMonth }) => {
            const key = toDateKey(date);
            const dayEvents = eventsForDay(sorted, date);
            const expanded = expandedDays.has(key);
            const visible = expanded ? dayEvents : dayEvents.slice(0, limit);
            const hiddenCount = dayEvents.length - visible.length;
            const selected = selection?.selectedDateKeys.includes(key) ?? false;
            const label = date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const plan = planabilityByDay?.[key];
            const planLabel = plan?.status === 'available' ? `Planbar: ${intervalText(plan.free)}` : plan?.status === 'busy' ? 'Verfügbarkeit belegt' : plan?.status === 'blocked' ? 'Nicht planbar' : 'Verfügbarkeit offen';
            return <div key={key} className="cs-calendar-day" data-outside={!inMonth} data-today={isSameDay(date, today)} data-weekend={date.getDay() === 0 || date.getDay() === 6} data-selected={selected} data-cs-assignment-drop-date={onAssignmentProfileDrop ? key : undefined} data-cs-assignment-drop-time="">
              {selectable && <button type="button" className="cs-calendar-day-select" disabled={selection?.disabled} aria-label={selection || selectedAssignmentProfileId ? `${label}, ${selected ? 'für das Einsatzprofil ausgewählt' : 'für das Einsatzprofil auswählen'}` : `${label} in der Tagesansicht öffnen`} aria-pressed={selection ? selected : undefined} title={selection ? 'Ein Klick ändert die Auswahl. Ein Doppelklick wählt nur diesen Tag.' : 'Tag öffnen'} onClick={(event) => {
                if (selection && !selection.disabled) selection.selectDate(date, assignmentProfileClickCount(event));
                else if (!selection && selectedAssignmentProfileId) onAssignmentProfileDrop?.(selectedAssignmentProfileId, date);
                else if (!selection) onSelectDate?.(date);
              }} />}
              <div className="cs-calendar-day-top"><span className="cs-calendar-day-number" aria-label={label}>{date.getDate()}</span><span className="cs-calendar-day-count">{selected ? '✓' : dayEvents.length ? dayEvents.length : ''}</span></div>
              {plan && <div className="cs-calendar-planability" data-status={plan.status}>{planLabel}{plan.status === 'unknown' && plan.blocked.length > 0 && <span> · Gesperrt: {intervalText(plan.blocked)}</span>}{plan.conflict && <strong>Planungskonflikt</strong>}</div>}
              <div className="cs-calendar-events">{visible.map((event) => <OfficeCalendarEventChip key={event.id} event={event} compact onEventPress={onEventPress} />)}</div>
              {hiddenCount > 0 && <button type="button" className="cs-calendar-more" aria-label={`${hiddenCount} weitere Einträge am ${label} anzeigen`} aria-expanded={false} onClick={(event) => { event.stopPropagation(); toggleDay(key); }}>+{hiddenCount} weitere</button>}
              {expanded && dayEvents.length > limit && <button type="button" className="cs-calendar-more" aria-expanded={true} onClick={(event) => { event.stopPropagation(); toggleDay(key); }}>Weniger anzeigen</button>}
            </div>;
          })}
        </div>
      </div>
    </div>
  </section>;
}
