// Generated native presentation from src/lib/calendar/calendarWorkspaceRefresh.web.ts. Update through scripts/port-native-workspaces.mjs.
/** Refresh mounted Web calendars after a confirmed mutation in an external drawer. */
const listeners = new Map<string, Set<() => void>>();
export function subscribeCalendarWorkspaceChanges(tenantId: string, listener: () => void) {
    const subscribers = listeners.get(tenantId) ?? new Set<() => void>();
    listeners.set(tenantId, subscribers);
    subscribers.add(listener);
    return () => {
        subscribers.delete(listener);
        if (!subscribers.size)
            listeners.delete(tenantId);
    };
}
export function notifyCalendarWorkspaceChanged(tenantId: string) {
    if (tenantId)
        listeners.get(tenantId)?.forEach((listener) => listener());
}
