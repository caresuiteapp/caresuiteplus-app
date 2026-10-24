// Generated native presentation from src/components/office/calendar/OfficeCalendarYearView.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeDiv,NativeHeader,NativeH2,NativeP,NativeButton,NativeSpan} from '@/components/layout/NativeWorkspaceElements.native';
import { useMemo } from 'react';
import type { CalendarEvent, WeekStartDay } from '@/types/modules/calendarEvent';
import { buildCalendarMonthStats } from '@/lib/calendar/calendarWebViewModel';
import { isSameDay, orderedWeekdayLabels } from '@/lib/office/calendarDateUtils';
import { CalendarViewStyles } from "../../calendar/CalendarViewStyles.native.tsx";
type Props = {
    weekStartDay?: WeekStartDay;
    anchor: Date;
    events: CalendarEvent[];
    onSelectMonth: (monthIndex: number) => void;
};
export function OfficeCalendarYearView({ anchor, events, onSelectMonth, weekStartDay = 1 }: Props) {
    const year = anchor.getFullYear();
    const months = useMemo(() => Array.from({ length: 12 }, (_, index) => buildCalendarMonthStats(events, year, index)), [events, year]);
    const today = new Date();
    return <NativeSection className="cs-calendar-view" aria-label="Jahreskalender"><CalendarViewStyles /><NativeDiv className="cs-calendar-surface">
    <NativeHeader className="cs-calendar-view-heading"><NativeH2>Jahresübersicht {year}</NativeH2><NativeP>Blau: Einträge · Goldene Linie: Abwesenheit</NativeP></NativeHeader>
    <NativeDiv className="cs-calendar-year-grid">{months.map(({ totalEvents, absenceDays, days }, monthIndex) => {
            const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString('de-DE', { month: 'long' });
            const offset = (new Date(year, monthIndex, 1).getDay() - weekStartDay + 7) % 7;
            return <NativeButton type="button" key={monthIndex} className="cs-calendar-month-tile" data-current={today.getFullYear() === year && today.getMonth() === monthIndex} aria-label={`${monthLabel} ${year} öffnen, ${totalEvents} Einträge, ${absenceDays} Tage mit Abwesenheiten`} onClick={() => onSelectMonth(monthIndex)}>
        <NativeSpan className="cs-calendar-month-name">{monthLabel}</NativeSpan><NativeSpan className="cs-calendar-month-summary"><NativeSpan>{totalEvents} {totalEvents === 1 ? 'Eintrag' : 'Einträge'}</NativeSpan><NativeSpan>{absenceDays} {absenceDays === 1 ? 'Tag' : 'Tage'} mit Abwesenheit</NativeSpan></NativeSpan>
        <NativeSpan className="cs-calendar-mini-grid" aria-hidden="true">
          {orderedWeekdayLabels(weekStartDay).map((label) => <NativeSpan key={label} className="cs-calendar-mini-weekday">{label}</NativeSpan>)}
          {Array.from({ length: offset }, (_, index) => <NativeSpan key={`empty-${index}`}/>)}
          {days.map(({ date, key, count, absence }) => <NativeSpan key={key} className="cs-calendar-mini-day" data-busy={count > 0} data-absence={absence} data-today={isSameDay(date, today)} title={`${date.toLocaleDateString('de-DE')}: ${count} Einträge${absence ? ', Abwesenheit' : ''}`}>{date.getDate()}</NativeSpan>)}
        </NativeSpan>
      </NativeButton>;
        })}</NativeDiv>
  </NativeDiv></NativeSection>;
}
