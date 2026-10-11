import { useCallback, useEffect, useRef, useState } from 'react';
import type { ServiceResult } from '@/types';
import type { AssignmentExecution } from '@/types/modules/assist';
import {
  checkInAssignment,
  checkOutAssignment,
  fetchAssignmentExecution,
  startAssignmentWork,
} from '@/lib/assist';
import { subscribeToAssistOperationsChanges } from '@/lib/realtime';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { OPERATIONAL_LIVE_POLL_MS, useAsyncQuery } from './core';

export function useAssignmentExecution(assignmentId: string | undefined) {
  const { profile, user, portalSession } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;
  const scope = JSON.stringify([tenantId, assignmentId, profile?.id, roleKey, user?.id, portalSession?.accountId]);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const lock = useRef<string | null>(null);
  const [actionState, setActionState] = useState<{ scope: string; loading: boolean; error: string | null; successMessage: string | null }>({ scope, loading: false, error: null, successMessage: null });
  useEffect(() => {
    scopeRef.current = scope;
    return () => { if (scopeRef.current === scope) scopeRef.current = ''; };
  }, [scope]);

  const query = useAsyncQuery<AssignmentExecution>(
    () => {
      if (!assignmentId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchAssignmentExecution(assignmentId, tenantId, roleKey);
    },
    [assignmentId, tenantId, roleKey, scope],
    {
      enabled: Boolean(assignmentId) && !!tenantId,
      queryKey: scope,
      live: tenantId
        ? {
            tenantId,
            subscribe: subscribeToAssistOperationsChanges,
            pollMs: OPERATIONAL_LIVE_POLL_MS,
          }
        : undefined,
    },
  );

  const mutate = useCallback(async (operation: () => Promise<ServiceResult<AssignmentExecution>>, successMessage: string) => {
    if (scopeRef.current !== scope || lock.current === scope) return null;
    lock.current = scope;
    setActionState({ scope, loading: true, error: null, successMessage: null });
    try {
      const result = await operation();
      if (scopeRef.current !== scope) return null;
      if (!result.ok) {
        setActionState({ scope, loading: false, error: result.error, successMessage: null });
        return null;
      }
      if (result.data.tenantId !== tenantId) {
        setActionState({ scope, loading: false, error: 'Die Durchführung konnte diesem Mandanten nicht zugeordnet werden.', successMessage: null });
        return null;
      }
      query.setData(result.data);
      setActionState({ scope, loading: false, error: null, successMessage });
      return result.data;
    } catch {
      if (scopeRef.current === scope) setActionState({ scope, loading: false, error: 'Die Aktion wurde nicht bestätigt. Bitte den Einsatzstatus erneut laden.', successMessage: null });
      return null;
    } finally {
      if (lock.current === scope) lock.current = null;
    }
  }, [scope, tenantId, query.setData]);
  const execute = useCallback((action: 'check_in' | 'start' | 'check_out', note?: string) => mutate(() => {
    if (!assignmentId || !tenantId) return Promise.resolve({ ok: false as const, error: 'Einsatz oder Mandant fehlt.' });
    return action === 'check_in' ? checkInAssignment(assignmentId, tenantId, roleKey, note)
      : action === 'start' ? startAssignmentWork(assignmentId, tenantId, roleKey)
      : checkOutAssignment(assignmentId, tenantId, roleKey, note);
  }, action === 'check_in' ? 'Ankunft bestätigt.' : action === 'start' ? 'Einsatz gestartet.' : 'Einsatz abgeschlossen.'), [assignmentId, tenantId, roleKey, mutate]);
  const currentAction = actionState.scope === scope ? actionState : null;
  return {
    data: query.data, loading: query.loading, error: query.error ?? currentAction?.error ?? null,
    actionLoading: currentAction?.loading ?? false, successMessage: currentAction?.successMessage ?? null,
    refresh: query.refresh, isLiveConnected: query.isLiveConnected,
    checkIn: useCallback((note?: string) => execute('check_in', note), [execute]),
    startWork: useCallback(() => execute('start'), [execute]),
    checkOut: useCallback((note?: string) => execute('check_out', note), [execute]),
  };
}
