import { useMemo } from 'react';
import type { CalendarEvent, WeekStartDay } from '@/types/modules/calendarEvent';
import { buildCalendarMonthStats } from '@/lib/calendar/calendarWebViewModel';
import { isSameDay, orderedWeekdayLabels } from '@/lib/office/calendarDateUtils';
import { CalendarViewStyles } from '@/components/calendar/CalendarViewStyles.web';
type Props = { weekStartDay?: WeekStartDay; anchor: Date; events: CalendarEvent[]; onSelectMonth: (monthIndex: number) => void };
export function OfficeCalendarYearView({ anchor, events, onSelectMonth, weekStartDay = 1 }: Props) {
  const year = anchor.getFullYear();
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => buildCalendarMonthStats(events, year, index)), [events, year]);
  const today = new Date();
  return <section className="cs-calendar-view" aria-label="Jahreskalender"><CalendarViewStyles /><div className="cs-calendar-surface">
    <header className="cs-calendar-view-heading"><h2>Jahresübersicht {year}</h2><p>Blau: Einträge · Goldene Linie: Abwesenheit</p></header>
    <div className="cs-calendar-year-grid">{months.map(({ totalEvents, absenceDays, days }, monthIndex) => {
      const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString('de-DE', { month: 'long' });
      const offset = (new Date(year, monthIndex, 1).getDay() - weekStartDay + 7) % 7;
      return <button type="button" key={monthIndex} className="cs-calendar-month-tile" data-current={today.getFullYear() === year && today.getMonth() === monthIndex} aria-label={`${monthLabel} ${year} öffnen, ${totalEvents} Einträge, ${absenceDays} Tage mit Abwesenheiten`} onClick={() => onSelectMonth(monthIndex)}>
        <span className="cs-calendar-month-name">{monthLabel}</span><span className="cs-calendar-month-summary"><span>{totalEvents} {totalEvents === 1 ? 'Eintrag' : 'Einträge'}</span><span>{absenceDays} {absenceDays === 1 ? 'Tag' : 'Tage'} mit Abwesenheit</span></span>
        <span className="cs-calendar-mini-grid" aria-hidden="true">
          {orderedWeekdayLabels(weekStartDay).map((label) => <span key={label} className="cs-calendar-mini-weekday">{label}</span>)}
          {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
          {days.map(({ date, key, count, absence }) => <span key={key} className="cs-calendar-mini-day" data-busy={count > 0} data-absence={absence} data-today={isSameDay(date, today)} title={`${date.toLocaleDateString('de-DE')}: ${count} Einträge${absence ? ', Abwesenheit' : ''}`}>{date.getDate()}</span>)}
        </span>
      </button>;
    })}</div>
  </div></section>;
}
