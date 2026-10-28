// Generated native presentation from src/hooks/useEmployeeMonthPlanning.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { listPlanningEmployees, loadPlanningSnapshot, type PlanningEmployee, type PlanningSnapshot } from '@/lib/calendar/employeeMonthPlanningService';
import { subscribeCalendarWorkspaceChanges } from "../lib/calendar/calendarWorkspaceRefresh.native.ts";
export function useEmployeeMonthPlanning(tenantId: string | null, employeeId: string, fromMonth: string, toMonth: string, enabled: boolean) {
    const { profile } = useAuth();
    const scope = JSON.stringify([tenantId, profile?.id, profile?.roleKey, enabled]);
    const [employees, setEmployees] = useState<{
        scope: string;
        rows: PlanningEmployee[];
        error?: string;
    }>({ scope: '', rows: [] });
    const [version, setVersion] = useState(0);
    const [state, setState] = useState<{
        key: string;
        data?: PlanningSnapshot;
        error?: string;
    }>({ key: '' });
    const requestId = useRef(0);
    const key = JSON.stringify([scope, employeeId, fromMonth, toMonth, version]);
    useEffect(() => {
        let live = true;
        if (enabled && tenantId)
            void listPlanningEmployees(tenantId).then((rows) => {
                if (live)
                    setEmployees({ scope, rows });
            }).catch((cause: unknown) => {
                if (live)
                    setEmployees({ scope, rows: [], error: cause instanceof Error ? cause.message : 'Mitarbeitende konnten nicht geladen werden.' });
            });
        return () => { live = false; };
    }, [tenantId, enabled, version, scope]);
    useEffect(() => {
        const id = ++requestId.current;
        if (enabled && tenantId)
            void loadPlanningSnapshot(tenantId, fromMonth, toMonth, employeeId).then((data) => {
                if (id === requestId.current)
                    setState({ key, data });
            }).catch((cause: unknown) => {
                if (id === requestId.current)
                    setState({ key, error: cause instanceof Error ? cause.message : 'Planbarkeit konnte nicht geprüft werden.' });
            });
        return () => { requestId.current++; };
    }, [tenantId, employeeId, fromMonth, toMonth, enabled, key]);
    const refresh = useCallback(() => setVersion((value) => value + 1), []);
    useEffect(() => tenantId && enabled ? subscribeCalendarWorkspaceChanges(tenantId, refresh) : undefined, [tenantId, enabled, refresh]);
    const current = enabled && state.key === key ? state : null;
    return {
        employees: enabled && employees.scope === scope ? employees.rows : [],
        employeeError: enabled && employees.scope === scope ? employees.error ?? null : null,
        plans: current?.data?.plans ?? [], absences: current?.data?.absences ?? [],
        loading: enabled && !!tenantId && !current, error: current?.error ?? null, ready: !!current?.data, refresh,
    };
}
