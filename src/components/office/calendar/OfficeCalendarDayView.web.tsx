import { useMemo } from 'react';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { formatDayHeader } from '@/lib/office/calendarDateUtils';
import type { AssignmentProfileDropHandler } from '@/components/calendar/OfficeAssignmentProfileCalendarPlanner';
import { CalendarTimeGrid } from '@/components/calendar/CalendarTimeGrid.web';
type Props = { anchor: Date; events: CalendarEvent[]; dayViewStartHour: number; onEventPress?: (event: CalendarEvent) => void; selectedAssignmentProfileId?: string | null; onAssignmentProfileDrop?: AssignmentProfileDropHandler };
export function OfficeCalendarDayView({ anchor, dayViewStartHour, ...props }: Props) {
  const days = useMemo(() => [anchor], [anchor]);
  return <CalendarTimeGrid {...props} title={formatDayHeader(anchor)} days={days} startHour={0} endHour={24} scrollHour={dayViewStartHour} />;
}
