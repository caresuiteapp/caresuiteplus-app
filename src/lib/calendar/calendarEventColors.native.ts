// Generated native presentation from src/lib/calendar/calendarEventColors.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { CSSProperties } from 'react';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { resolveAssignmentCalendarVisual, type AssignmentCalendarState } from "./assignmentCalendarPresentation.native.ts";
export type CalendarEventColors = {
    accent: string;
    background: string;
    hover: string;
    border: string;
};
/** Opaque light surfaces keep the status visible on every calendar background. */
export const ASSIGNMENT_CALENDAR_COLORS: Record<AssignmentCalendarState, CalendarEventColors> = {
    scheduled: { accent: '#1D4ED8', background: '#D9E7FF', hover: '#C9DCFF', border: '#91B2ED' },
    active: { accent: '#0E7490', background: '#C7EEF5', hover: '#B2E4EF', border: '#6DBACB' },
    open: { accent: '#B45309', background: '#FFE3BA', hover: '#FFD49B', border: '#D6A15C' },
    problem: { accent: '#B91C1C', background: '#FFD4D4', hover: '#FFC1C1', border: '#DE8989' },
    completed: { accent: '#15803D', background: '#C9ECD5', hover: '#B1E1C2', border: '#79BC91' },
    cancelled: { accent: '#475569', background: '#E0E6ED', hover: '#D1DAE4', border: '#A3AFBE' },
};
export function resolveCalendarEventColors(event: CalendarEvent, now?: Date): CalendarEventColors {
    const assignment = resolveAssignmentCalendarVisual(event, now);
    if (assignment)
        return ASSIGNMENT_CALENDAR_COLORS[assignment.state];
    // Keep source/category colours for holidays, birthdays, absences and custom events.
    const accent = event.color || '#427DB9';
    return {
        accent,
        background: `color-mix(in srgb, ${accent} 26%, white)`,
        hover: `color-mix(in srgb, ${accent} 36%, white)`,
        border: `color-mix(in srgb, ${accent} 72%, #47617a)`,
    };
}
export function calendarEventColorVariables(colors: CalendarEventColors): CSSProperties {
    return {
        '--event-accent': colors.accent,
        '--event-background': colors.background,
        '--event-hover': colors.hover,
        '--event-border': colors.border,
    } as CSSProperties;
}
