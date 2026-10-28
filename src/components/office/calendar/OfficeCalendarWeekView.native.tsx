// Generated native presentation from src/components/office/calendar/OfficeCalendarWeekView.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { useMemo } from 'react';
import type { CalendarEvent, WeekStartDay } from '@/types/modules/calendarEvent';
import { formatWeekRange, getWeekDays } from '@/lib/office/calendarDateUtils';
import type { AssignmentProfileDropHandler } from "../../calendar/OfficeAssignmentProfileCalendarPlanner.native.tsx";
import { CalendarTimeGrid } from "../../calendar/CalendarTimeGrid.native.tsx";
type Props = {
    anchor: Date;
    events: CalendarEvent[];
    weekStartDay: WeekStartDay;
    weekFullDay: boolean;
    dayViewStartHour: number;
    onEventPress?: (event: CalendarEvent) => void;
    selectedAssignmentProfileId?: string | null;
    onAssignmentProfileDrop?: AssignmentProfileDropHandler;
};
export function OfficeCalendarWeekView({ anchor, weekStartDay, weekFullDay, dayViewStartHour, ...props }: Props) {
    const days = useMemo(() => getWeekDays(anchor, weekStartDay), [anchor, weekStartDay]);
    return <CalendarTimeGrid {...props} title={formatWeekRange(anchor, weekStartDay)} days={days} startHour={weekFullDay ? 0 : 7} endHour={weekFullDay ? 24 : 21} scrollHour={weekFullDay ? dayViewStartHour : 7}/>;
}
