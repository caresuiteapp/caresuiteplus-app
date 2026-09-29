import { useCallback, useEffect, useRef, useState } from 'react';
import { listPlanningEmployees, loadPlanningSnapshot, type PlanningEmployee, type PlanningSnapshot } from '@/lib/calendar/employeeMonthPlanningService';

export function useEmployeeMonthPlanning(tenantId: string | null, employeeId: string, fromMonth: string, toMonth: string, enabled: boolean) {
  const [employees, setEmployees] = useState<{ tenant: string; rows: PlanningEmployee[] }>({ tenant: '', rows: [] });
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ key: string; data?: PlanningSnapshot; error?: string }>({ key: '' });
  const requestId = useRef(0);
  const key = `${tenantId}:${employeeId}:${fromMonth}:${toMonth}:${version}`;
  useEffect(() => {
    let live = true;
    setEmployeeError(null);
    if (enabled && tenantId) void listPlanningEmployees(tenantId).then((rows) => {
      if (live) setEmployees({ tenant: tenantId, rows });
    }).catch((e: Error) => { if (live) setEmployeeError(e.message); });
    return () => { live = false; };
  }, [tenantId, enabled, version]);
  useEffect(() => {
    const id = ++requestId.current;
    if (enabled && tenantId) void loadPlanningSnapshot(tenantId, fromMonth, toMonth, employeeId).then((data) => {
      if (id === requestId.current) setState({ key, data });
    }).catch((e: Error) => {
      if (id === requestId.current) setState({ key, error: e.message });
    });
    return () => { requestId.current++; };
  }, [tenantId, employeeId, fromMonth, toMonth, enabled, key]);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const current = enabled && state.key === key ? state : null;
  return {
    employees: employees.tenant === tenantId ? employees.rows : [],
    employeeError, plans: current?.data?.plans ?? [], absences: current?.data?.absences ?? [],
    loading: enabled && !!tenantId && !current,
    error: current?.error ?? null, ready: !!current?.data, refresh,
  };
}
