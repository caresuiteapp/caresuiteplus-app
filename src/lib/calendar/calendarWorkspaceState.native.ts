// Generated native presentation from src/lib/calendar/calendarWorkspaceState.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { CalendarViewMode } from '@/types/modules/calendarEvent';
import type { AssignmentCalendarState } from './assignmentCalendarStatus';
import { toDateKey } from '@/lib/office/calendarDateUtils';
export type CalendarWorkspaceState = {
    view: CalendarViewMode;
    anchor: string;
    employeeId: string;
    query: string;
    status: 'all' | AssignmentCalendarState;
};
const VIEWS = ['day', 'week', 'month', 'year', 'agenda', 'list'];
const STATES = ['all', 'scheduled', 'active', 'open', 'problem', 'completed', 'cancelled'];
export function calendarWorkspaceKey(tenant: string, user: string, module: string, windowId = '') {
    return `caresuite.calendar.workspace.v1.${JSON.stringify([tenant, user, module, windowId])}`;
}
export function calendarAnchor(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return null;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1900 || year > 2200)
        return null;
    const date = new Date(year, month - 1, day, 12);
    return toDateKey(date) === value ? date : null;
}
export function readCalendarWorkspace(key: string, fallbackView: CalendarViewMode, now = new Date()): {
    state: CalendarWorkspaceState;
    restored: boolean;
} {
    const defaults: CalendarWorkspaceState = { view: fallbackView, anchor: toDateKey(now), employeeId: '', query: '', status: 'all' };
    try {
        const value = JSON.parse(window.sessionStorage.getItem(key) ?? 'null');
        if (!value || !VIEWS.includes(value.view) || typeof value.anchor !== 'string' || !calendarAnchor(value.anchor))
            return { state: defaults, restored: false };
        return { restored: true, state: {
                view: value.view, anchor: value.anchor,
                employeeId: typeof value.employeeId === 'string' && value.employeeId.length <= 200 ? value.employeeId : '',
                query: typeof value.query === 'string' ? value.query.slice(0, 200) : '',
                status: STATES.includes(value.status) ? value.status : 'all',
            } };
    }
    catch {
        return { state: defaults, restored: false };
    }
}
export function saveCalendarWorkspace(key: string, state: CalendarWorkspaceState): boolean {
    try {
        window.sessionStorage.setItem(key, JSON.stringify(state));
        return true;
    }
    catch {
        return false;
    }
}
