import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/lib/auth/context';
import type { PortalActor } from '@/hooks/usePortalActor';
import { getServiceMode } from '@/lib/services/mode';
import { hydrateTenantModulesFromSupabase } from '@/lib/modules/moduleAccessHydration';
import { hasEffectiveModuleGateAccess } from '@/lib/modules/moduleAccessService';
import { resolveProductModuleAccessDecision } from '@/lib/modules/platformTenantModuleAccess';
import { NATIVE_SERVICE_QUERY_TIMEOUT_MS, withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { loadEmployeePortalWorkspaceGrants } from '@/lib/portal/employee/employeePortalWorkspaceService';
import { employeePortalNavigation } from '@/lib/portal/employee/employeePortalNavigation';
import {
  availableEmployeePortalWorkspaces, employeePortalWorkspaceStorageKey,
  resolveEmployeePortalWorkspace, type EmployeePortalWorkspace,
} from '@/lib/portal/employee/employeePortalWorkspaces';
import type { EmployeePortalWorkspaceState } from '@/components/portal/employee/EmployeePortalWorkspaceContext';

type Access = { scope: string; available: EmployeePortalWorkspace[]; error: string | null };
type Preference = { key: string; value: string | null; error: boolean };
const ACCESS_ERROR = 'Die Modulfreigaben konnten nicht geprüft werden.';
const ACCESS_REFRESH_MS = 60_000;

export function useEmployeePortalWorkspace(actor: PortalActor): EmployeePortalWorkspaceState {
  const { user, portalSession } = useAuth();
  const { tenantId, employeeId, isLinkedReady, isResolvingEmployeeLink, employeeLinkReadOnly, actorId } = actor;
  const accountId = portalSession?.accountId ?? user?.id ?? actorId;
  const key = tenantId && accountId && employeeId && isLinkedReady
    ? employeePortalWorkspaceStorageKey(tenantId, accountId, employeeId) : null;
  const scope = key && JSON.stringify([key, user?.id, actor.roleKey, portalSession?.sessionToken]);
  const [access, setAccess] = useState<Access | null>(null);
  const [preference, setPreference] = useState<Preference | null>(null);
  const [revision, setRevision] = useState(0);
  const writeQueue = useRef(Promise.resolve());
  const saved = preference?.key === key ? preference : null;
  const confirmed = access?.scope === scope ? access : null;

  useEffect(() => {
    if (!key) return;
    let active = true;
    void AsyncStorage.getItem(key).then(
      value => { if (active) setPreference({ key, value, error: false }); },
      () => { if (active) setPreference({ key, value: null, error: true }); },
    );
    return () => { active = false; };
  }, [key]);

  useEffect(() => {
    if (!scope || !tenantId || !employeeId || employeeLinkReadOnly) return;
    let active = true;
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const [grants, tenant] = await withServiceQueryTimeout(Promise.all([
          loadEmployeePortalWorkspaceGrants(tenantId, employeeId, true),
          hydrateTenantModulesFromSupabase(tenantId),
        ]), 'Prüfung der Modulfreigaben', NATIVE_SERVICE_QUERY_TIMEOUT_MS);
        if (!active) return;
        const demo = getServiceMode() === 'demo';
        const available = grants.ok && tenant.ok ? availableEmployeePortalWorkspaces(
          grants.data.products,
          product => demo ? product === 'assist' : product === 'beratung'
            ? resolveProductModuleAccessDecision(tenantId, product, false).allowed
            : hasEffectiveModuleGateAccess(product, tenantId),
        ) : [];
        setAccess({ scope, available, error: grants.ok && tenant.ok ? null : ACCESS_ERROR });
      } catch {
        if (active) setAccess({ scope, available: [], error: ACCESS_ERROR });
      } finally {
        busy = false;
      }
    };
    void refresh();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, ACCESS_REFRESH_MS);
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => { active = false; clearInterval(interval); listener.remove(); };
  }, [scope, tenantId, employeeId, revision, employeeLinkReadOnly]);

  // A verified offline link may keep the original read-only Assist cache path.
  // A known personal restriction takes priority over the legacy fallback.
  const available = employeeLinkReadOnly
    ? confirmed?.available.filter(module => module === 'assist') ?? ['assist' as const]
    : confirmed?.available ?? [];
  const loading = isResolvingEmployeeLink || Boolean(key && ((!confirmed && !employeeLinkReadOnly) || !saved));
  const selected = loading ? null : resolveEmployeePortalWorkspace(available, saved?.value ?? null);

  function select(module: EmployeePortalWorkspace) {
    if (!key || loading || !available.includes(module)) return;
    setPreference({ key, value: module, error: false });
    writeQueue.current = writeQueue.current.then(() => AsyncStorage.setItem(key, module)).catch(() => {
      setPreference(current => current?.key === key && current.value === module ? { ...current, error: true } : current);
    });
  }

  return {
    selected, available, navigation: employeePortalNavigation(selected), loading,
    error: employeeLinkReadOnly ? null : confirmed?.error ?? null,
    preferenceError: saved?.error ?? false, retry: () => setRevision(value => value + 1), select,
  };
}
