// Generated native presentation from src/components/office/calendar/OfficeCalendarMonthView.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeDiv,NativeHeader,NativeH2,NativeP,NativeButton,NativeSpan,NativeStrong} from '@/components/layout/NativeWorkspaceElements.native';
import { useMemo, useState } from 'react';
import type { CalendarEvent, WeekStartDay } from '@/types/modules/calendarEvent';
import { eventsForDay, formatMonthYear, getMonthGridDays, isSameDay, orderedWeekdayLabels, toDateKey } from '@/lib/office/calendarDateUtils';
import { sortedCalendarEvents } from '@/lib/calendar/calendarWebViewModel';
import { intervalText, type DayPlanability } from '@/lib/calendar/employeeMonthPlanning';
import { assignmentProfileClickCount, useAssignmentProfileDateSelection } from '@/components/calendar/AssignmentProfileDateSelection';
import type { AssignmentProfileDropHandler } from "../../calendar/OfficeAssignmentProfileCalendarPlanner.native.tsx";
import { CalendarViewStyles } from "../../calendar/CalendarViewStyles.native.tsx";
import { OfficeCalendarEventChip } from "./OfficeCalendarEventChip.native.tsx";
type Props = {
    anchor: Date;
    events: CalendarEvent[];
    weekStartDay: WeekStartDay;
    maxCollapsedEvents: number;
    onEventPress?: (event: CalendarEvent) => void;
    selectedAssignmentProfileId?: string | null;
    onAssignmentProfileDrop?: AssignmentProfileDropHandler;
    planabilityByDay?: Record<string, DayPlanability>;
    onSelectDate?: (date: Date) => void;
};
export function OfficeCalendarMonthView({ anchor, events, weekStartDay, maxCollapsedEvents, onEventPress, selectedAssignmentProfileId, onAssignmentProfileDrop, planabilityByDay, onSelectDate }: Props) {
    const selection = useAssignmentProfileDateSelection();
    const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set());
    const days = useMemo(() => getMonthGridDays(anchor, weekStartDay), [anchor, weekStartDay]);
    const sorted = useMemo(() => sortedCalendarEvents(events), [events]);
    const limit = Math.max(1, Math.floor(maxCollapsedEvents) || 3);
    const toggleDay = (key: string) => setExpandedDays((previous) => { const next = new Set(previous); if (next.has(key))
        next.delete(key);
    else
        next.add(key); return next; });
    const today = new Date();
    const selectable = Boolean(selection || (selectedAssignmentProfileId && onAssignmentProfileDrop) || onSelectDate);
    return <NativeSection className="cs-calendar-view" aria-label="Monatskalender">
    <CalendarViewStyles />
    <NativeDiv className="cs-calendar-surface">
      <NativeHeader className="cs-calendar-view-heading"><NativeH2>{formatMonthYear(anchor)}</NativeH2><NativeP>{events.length} {events.length === 1 ? 'Eintrag' : 'Einträge'} im angezeigten Zeitraum</NativeP></NativeHeader>
      <NativeP className="cs-calendar-scroll-hint">Für alle Wochentage seitlich scrollen. Einträge öffnen die Details.</NativeP>
      <NativeDiv className="cs-calendar-scroll" tabIndex={0} role="region" aria-label="Monatsraster, seitlich scrollbar">
        <NativeDiv className="cs-calendar-month-grid">
          {orderedWeekdayLabels(weekStartDay).map((label) => <NativeDiv className="cs-calendar-weekday" key={label}>{label}</NativeDiv>)}
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
            return <NativeDiv key={key} className="cs-calendar-day" data-outside={!inMonth} data-today={isSameDay(date, today)} data-weekend={date.getDay() === 0 || date.getDay() === 6} data-selected={selected} data-cs-assignment-drop-date={onAssignmentProfileDrop ? key : undefined} data-cs-assignment-drop-time="">
              {selectable && <NativeButton type="button" className="cs-calendar-day-select" disabled={selection?.disabled} aria-label={selection || selectedAssignmentProfileId ? `${label}, ${selected ? 'für das Einsatzprofil ausgewählt' : 'für das Einsatzprofil auswählen'}` : `${label} in der Tagesansicht öffnen`} aria-pressed={selection ? selected : undefined} title={selection ? 'Ein Klick ändert die Auswahl. Ein Doppelklick wählt nur diesen Tag.' : 'Tag öffnen'} onClick={(event) => {
                        if (selection && !selection.disabled)
                            selection.selectDate(date, assignmentProfileClickCount(event));
                        else if (!selection && selectedAssignmentProfileId)
                            onAssignmentProfileDrop?.(selectedAssignmentProfileId, date);
                        else if (!selection)
                            onSelectDate?.(date);
                    }}/>}
              <NativeDiv className="cs-calendar-day-top"><NativeSpan className="cs-calendar-day-number" aria-label={label}>{date.getDate()}</NativeSpan><NativeSpan className="cs-calendar-day-count">{selected ? '✓' : dayEvents.length ? dayEvents.length : ''}</NativeSpan></NativeDiv>
              {plan && <NativeDiv className="cs-calendar-planability" data-status={plan.status}>{planLabel}{plan.status === 'unknown' && plan.blocked.length > 0 && <NativeSpan> · Gesperrt: {intervalText(plan.blocked)}</NativeSpan>}{plan.conflict && <NativeStrong>Planungskonflikt</NativeStrong>}</NativeDiv>}
              <NativeDiv className="cs-calendar-events">{visible.map((event) => <OfficeCalendarEventChip key={event.id} event={event} compact onEventPress={onEventPress}/>)}</NativeDiv>
              {hiddenCount > 0 && <NativeButton type="button" className="cs-calendar-more" aria-label={`${hiddenCount} weitere Einträge am ${label} anzeigen`} aria-expanded={false} onClick={(event) => { event.stopPropagation(); toggleDay(key); }}>+{hiddenCount} weitere</NativeButton>}
              {expanded && dayEvents.length > limit && <NativeButton type="button" className="cs-calendar-more" aria-expanded={true} onClick={(event) => { event.stopPropagation(); toggleDay(key); }}>Weniger anzeigen</NativeButton>}
            </NativeDiv>;
        })}
        </NativeDiv>
      </NativeDiv>
    </NativeDiv>
  </NativeSection>;
}
