// Generated native presentation from src/components/office/calendar/OfficeCalendarEventChip.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeButton,NativeA,NativeDiv} from '@/components/layout/NativeWorkspaceElements.native';
import { useRouter } from 'expo-router';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { CalendarEventLabel, calendarEventAccessibleLabel } from "../../calendar/CalendarEventLabel.native.tsx";
import { isCancelledCalendarEvent } from '@/lib/calendar/calendarEventDisplay';
import { calendarEventColorVariables, resolveCalendarEventColors } from "../../../lib/calendar/calendarEventColors.native.ts";
type Props = {
    event: CalendarEvent;
    compact?: boolean;
    showTime?: boolean;
    onEventPress?: (event: CalendarEvent) => void;
};
export function OfficeCalendarEventChip({ event, compact = false, showTime = true, onEventPress }: Props) {
    const router = useRouter();
    const colors = resolveCalendarEventColors(event);
    const label = calendarEventAccessibleLabel(event);
    const props = {
        className: 'cs-calendar-event', 'data-calendar-event-id': event.id, 'data-compact': compact, 'data-cancelled': isCancelledCalendarEvent(event),
        style: calendarEventColorVariables(colors),
        title: label, 'aria-label': label,
    };
    const content = <CalendarEventLabel event={event} variant={compact ? 'compact' : 'stacked'} showTime={showTime} showService={!compact}/>;
    if (onEventPress)
        return <NativeButton type="button" {...props} onClick={(press) => { press.stopPropagation(); onEventPress(event); }}>{content}</NativeButton>;
    if (event.href)
        return <NativeA {...props} href={event.href} onClick={(press) => {
                press.stopPropagation();
                if (!press.metaKey && !press.ctrlKey && !press.shiftKey && !press.altKey && press.button === 0) {
                    press.preventDefault();
                    router.push(event.href as never);
                }
            }}>{content}</NativeA>;
    return <NativeDiv {...props}>{content}</NativeDiv>;
}
