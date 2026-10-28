// Generated native presentation from src/components/calendar/CalendarEventGrid.web.tsx. Update through scripts/port-native-workspaces.mjs.
import type { CalendarEvent, CalendarViewMode } from '@/types/modules/calendarEvent';
import { CalendarAgendaList } from "./CalendarAgendaList.native.tsx";
import { CalendarListView } from "./CalendarListView.native.tsx";
import { CalendarTimelineView } from './CalendarTimelineView';
import { OfficeCalendarDayView } from "../office/calendar/OfficeCalendarDayView.native.tsx";
import { OfficeCalendarMonthView } from "../office/calendar/OfficeCalendarMonthView.native.tsx";
import { OfficeCalendarWeekView } from "../office/calendar/OfficeCalendarWeekView.native.tsx";
import { OfficeCalendarYearView } from "../office/calendar/OfficeCalendarYearView.native.tsx";
import { startOfMonth } from '@/lib/office/calendarDateUtils';
import type { AssignmentProfileDropHandler } from "./OfficeAssignmentProfileCalendarPlanner.native.tsx";
type CalendarEventGridProps = {
    rangeStart?: Date;
    rangeEnd?: Date;
    onSelectDate?: (date: Date) => void;
    viewMode: CalendarViewMode;
    anchor: Date;
    events: CalendarEvent[];
    weekStartDay: import('@/types/modules/calendarEvent').WeekStartDay;
    maxCollapsedEvents: number;
    dayViewStartHour: number;
    weekFullDay: boolean;
    onEventPress?: (event: CalendarEvent) => void;
    onSelectMonth?: (monthIndex: number) => void;
    selectedAssignmentProfileId?: string | null;
    onAssignmentProfileDrop?: AssignmentProfileDropHandler;
    planabilityByDay?: Record<string, import('@/lib/calendar/employeeMonthPlanning').DayPlanability>;
};
export function CalendarEventGrid({ rangeStart, rangeEnd, onSelectDate, viewMode, anchor, events, weekStartDay, maxCollapsedEvents, dayViewStartHour, weekFullDay, onEventPress, onSelectMonth, selectedAssignmentProfileId, onAssignmentProfileDrop, planabilityByDay, }: CalendarEventGridProps) {
    if (viewMode === 'day') {
        return (<OfficeCalendarDayView anchor={anchor} events={events} dayViewStartHour={dayViewStartHour} onEventPress={onEventPress} selectedAssignmentProfileId={selectedAssignmentProfileId} onAssignmentProfileDrop={onAssignmentProfileDrop}/>);
    }
    if (viewMode === 'week') {
        return (<OfficeCalendarWeekView anchor={anchor} events={events} weekStartDay={weekStartDay} weekFullDay={weekFullDay} dayViewStartHour={dayViewStartHour} onEventPress={onEventPress} selectedAssignmentProfileId={selectedAssignmentProfileId} onAssignmentProfileDrop={onAssignmentProfileDrop}/>);
    }
    if (viewMode === 'month') {
        return (<OfficeCalendarMonthView onSelectDate={onSelectDate} planabilityByDay={planabilityByDay} anchor={anchor} events={events} weekStartDay={weekStartDay} maxCollapsedEvents={maxCollapsedEvents} onEventPress={onEventPress} selectedAssignmentProfileId={selectedAssignmentProfileId} onAssignmentProfileDrop={onAssignmentProfileDrop}/>);
    }
    if (viewMode === 'year') {
        return (<OfficeCalendarYearView weekStartDay={weekStartDay} anchor={anchor} events={events} onSelectMonth={(monthIndex) => {
                onSelectMonth?.(monthIndex);
            }}/>);
    }
    if (viewMode === 'agenda') {
        return <CalendarAgendaList events={events} onEventPress={onEventPress} rangeStart={rangeStart} rangeEnd={rangeEnd}/>;
    }
    if (viewMode === 'list') {
        return <CalendarListView events={events} onEventPress={onEventPress}/>;
    }
    return (<CalendarTimelineView events={events} anchor={anchor} onEventPress={onEventPress}/>);
}
export { startOfMonth };
