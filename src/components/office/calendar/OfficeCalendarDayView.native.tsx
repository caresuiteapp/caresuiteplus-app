// Generated native presentation from src/components/office/calendar/OfficeCalendarDayView.web.tsx. Update through scripts/port-native-workspaces.mjs.
import { useMemo } from 'react';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { formatDayHeader } from '@/lib/office/calendarDateUtils';
import type { AssignmentProfileDropHandler } from "../../calendar/OfficeAssignmentProfileCalendarPlanner.native.tsx";
import { CalendarTimeGrid } from "../../calendar/CalendarTimeGrid.native.tsx";
type Props = {
    anchor: Date;
    events: CalendarEvent[];
    dayViewStartHour: number;
    onEventPress?: (event: CalendarEvent) => void;
    selectedAssignmentProfileId?: string | null;
    onAssignmentProfileDrop?: AssignmentProfileDropHandler;
};
export function OfficeCalendarDayView({ anchor, dayViewStartHour, ...props }: Props) {
    const days = useMemo(() => [anchor], [anchor]);
    return <CalendarTimeGrid {...props} title={formatDayHeader(anchor)} days={days} startHour={0} endHour={24} scrollHour={dayViewStartHour}/>;
}
