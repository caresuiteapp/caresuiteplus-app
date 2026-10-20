import { useMemo } from 'react';
import type { CalendarEvent, WeekStartDay } from '@/types/modules/calendarEvent';
import { formatWeekRange, getWeekDays } from '@/lib/office/calendarDateUtils';
import type { AssignmentProfileDropHandler } from '@/components/calendar/OfficeAssignmentProfileCalendarPlanner';
import { CalendarTimeGrid } from '@/components/calendar/CalendarTimeGrid.web';
type Props = { anchor: Date; events: CalendarEvent[]; weekStartDay: WeekStartDay; weekFullDay: boolean; dayViewStartHour: number; onEventPress?: (event: CalendarEvent) => void; selectedAssignmentProfileId?: string | null; onAssignmentProfileDrop?: AssignmentProfileDropHandler };
export function OfficeCalendarWeekView({ anchor, weekStartDay, weekFullDay, dayViewStartHour, ...props }: Props) {
  const days = useMemo(() => getWeekDays(anchor, weekStartDay), [anchor, weekStartDay]);
  return <CalendarTimeGrid {...props} title={formatWeekRange(anchor, weekStartDay)} days={days} startHour={weekFullDay ? 0 : 7} endHour={weekFullDay ? 24 : 21} scrollHour={weekFullDay ? dayViewStartHour : 7} />;
}
