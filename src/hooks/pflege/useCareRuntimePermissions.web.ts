import { createContext, createElement, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PermissionDecision, PermissionKey } from '@/types/permissions';
import { ROLE_LABELS } from '@/data/constants';
import { checkPermissionWithList } from '@/lib/permissions/check';
import { hasEffectiveModuleGateAccess } from '@/lib/modules/moduleAccessService';
import { isDemoMode } from '@/lib/supabase/config';
import { useAuth } from '@/lib/auth/context';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';
import { getSession } from '@/lib/supabase';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { carePermissionOwner, sameCarePermissionOwner, carePermissionOwnerIsCurrent } from '@/lib/permissions/carePermissionOwner.web';
import type { CarePermissionOwner } from '@/lib/permissions/carePermissionOwner.web';
import { fetchConfirmedCarePermissions as fetchCurrentCarePermissions } from '@/lib/permissions/confirmedCarePermissions.web';

type PermissionRead = {
  owner: CarePermissionOwner | null;
  revision: number;
  alive: boolean;
  suspended: boolean;
  resumeQueued: boolean;
  ticket: symbol | null;
  status: 'loading' | 'ready' | 'error' | 'denied';
  permissions: readonly PermissionKey[];
  error: string | null;
};
type ExpiredSession = NonNullable<ReturnType<typeof useAuth>['session']>;
const noPermissions: readonly PermissionKey[] = Object.freeze([]);
const CarePermissionContext = createContext<ReturnType<typeof useCarePermissionRead> | null>(null);
const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

function clearPermissionRead(read: PermissionRead) {
  read.ticket = null;
  read.permissions = noPermissions;
  read.status = 'loading';
  read.error = null;
}

/** One confirmation for the mounted Pflege navigator and its nested screens. */
export function CareRuntimePermissionsProvider({ children }: { children?: ReactNode }) {
  const permissions = useCarePermissionRead(true);
  return createElement(CarePermissionContext.Provider, { value: permissions }, children);
}

export function useCareRuntimePermissions() {
  const shared = useContext(CarePermissionContext);
  const local = useCarePermissionRead(shared === null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  if (!shared) return local;

  return {
    ...shared,
    can: (permission: PermissionKey) => mounted.current && shared.can(permission),
    canAny: (keys: PermissionKey[]) => mounted.current && shared.canAny(keys),
    canAll: (keys: PermissionKey[]) => mounted.current && shared.canAll(keys),
    check: (permission: PermissionKey): PermissionDecision =>
      mounted.current ? shared.check(permission) : { allowed: false },
    hasModuleGate: (moduleKey: import('@/types').ProductKey) => mounted.current && shared.hasModuleGate(moduleKey),
    refreshPermissions: () => { if (mounted.current) shared.refreshPermissions(); },
  };
}

function useCarePermissionRead(enabled: boolean) {
  const auth = useAuth(), tenantId = useServiceTenantId(), demo = isDemoMode();
  const roleKey = resolveEffectiveRoleKey(auth.profile, auth.user, auth.portalSession);
  const owner = enabled ? carePermissionOwner(auth, tenantId, demo) : null;
  const session = auth.session;
  const expiredSession = enabled && !demo && !owner && auth.authReady && auth.isAuthenticated
    && !auth.isLoading && !auth.profileBootstrapError && !auth.portalSession
    && session?.user.id === auth.user?.id && typeof session?.expiresAt === 'number'
    && Number.isFinite(session.expiresAt) && session.expiresAt <= Date.now()
    ? session : null;
  const [revision, setRevision] = useState(0), [, setUpdate] = useState(0);
  const [failedRenewal, setFailedRenewal] = useState<{ session: ExpiredSession; revision: number } | null>(null);
  const renewalFailed = !!expiredSession && failedRenewal?.session === expiredSession && failedRenewal.revision === revision;
  const current = useRef<PermissionRead | null>(null);
  const pageHidden = useRef(false);
  if (!current.current || !sameCarePermissionOwner(current.current.owner, owner) || current.current.revision !== revision) {
    if (current.current) { current.current.alive = false; current.current.ticket = null; current.current.permissions = noPermissions; }
    current.current = { owner, revision, alive: false, suspended: false, resumeQueued: false, ticket: null, status: owner ? 'loading' : 'denied', permissions: noPermissions, error: null };
  }
  const read = current.current;
  const ownRead = () => current.current === read && read.alive && !read.suspended && carePermissionOwnerIsCurrent(read.owner);
  const confirmed = read.status === 'ready' ? read.permissions : noPermissions;
  const grants = () => ownRead() && read.status === 'ready' && read.permissions === confirmed
    ? confirmed : noPermissions;
  const isConfirmed = () => confirmed !== noPermissions && grants() === confirmed;
  const refreshPermissions = () => {
    if (!ownRead() && !(expiredSession && current.current === read && read.alive && !isHidden())) return;
    if (read.owner) clearPermissionRead(read);
    setRevision(value => value + 1);
  };

  useEffect(() => {
    if (!expiredSession || isHidden()) return;
    let active = true;
    const failure = () => {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      setFailedRenewal({ session: expiredSession, revision });
    };
    const timer = setTimeout(failure, 15_000);
    // The SDK renews an expired token when the saved session is read. The
    // AuthProvider publishes the verified refresh event before the next read.
    void getSession().then(result => {
      if (active && (!result.ok || !result.data
        || result.data.user.id !== expiredSession.user.id
        || result.data.access_token === expiredSession.accessToken)) failure();
    }).catch(failure);
    return () => { active = false; clearTimeout(timer); };
  }, [expiredSession, revision]);
  const hasOwner = !!owner;
  useEffect(() => {
    if (!hasOwner || typeof document === 'undefined' || typeof window === 'undefined') return;
    const suspend = () => {
      const active = current.current;
      if (!active?.alive || active.suspended) return;
      active.suspended = true;
      clearPermissionRead(active);
      setUpdate(value => value + 1);
    };
    const resume = () => {
      const active = current.current;
      if (!active?.alive || isHidden() || pageHidden.current || active.resumeQueued
        || (active.status === 'loading' && !active.suspended)) return;
      active.resumeQueued = true;
      clearPermissionRead(active);
      setRevision(value => value + 1);
    };
    const onVisibility = () => { if (isHidden()) suspend(); else resume(); };
    const onPageHide = () => { pageHidden.current = true; suspend(); };
    const onPageShow = () => { pageHidden.current = false; resume(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('online', resume);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', resume);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('online', resume);
    };
  }, [hasOwner]);

  useEffect(() => {
    if (read.status === 'ready') clearPermissionRead(read);
    read.alive = true;
    const ticket = Symbol('care-permission-read'); read.ticket = ticket;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (read.owner) {
      read.suspended = isHidden() || pageHidden.current;
      if (!read.suspended) void fetchCurrentCarePermissions(read.owner, () => ownRead() && read.ticket === ticket).then(permissions => {
        if (!ownRead() || read.ticket !== ticket) return;
        read.permissions = Object.freeze([...permissions]); read.status = 'ready'; setUpdate(value => value + 1);
      }).catch(() => {
        if (!ownRead() || read.ticket !== ticket) return;
        read.permissions = noPermissions; read.status = 'error'; read.error = 'Die aktuellen Berechtigungen konnten nicht bestätigt werden.'; setUpdate(value => value + 1);
      });
      if (read.owner.expiresAt !== null) timer = setTimeout(() => {
        if (current.current !== read || !read.alive || read.ticket !== ticket) return;
        read.permissions = noPermissions; read.ticket = null; read.status = 'denied'; setRevision(value => value + 1);
      }, Math.min(2_147_483_647, Math.max(0, read.owner.expiresAt - Date.now())));
    }
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      read.alive = false;
      read.ticket = null;
      read.permissions = noPermissions;
    };
  }, [read]);
  return {
    roleKey, roleLabel: roleKey ? ROLE_LABELS[roleKey] : null, tenantId,
    permissions: grants(),
    can: (permission: PermissionKey) => grants().includes(permission),
    canAny: (keys: PermissionKey[]) => isConfirmed() && keys.some(key => confirmed.includes(key)),
    canAll: (keys: PermissionKey[]) => isConfirmed() && keys.every(key => confirmed.includes(key)),
    check: (permission: PermissionKey): PermissionDecision => isConfirmed() ? checkPermissionWithList(roleKey, confirmed, permission) : { allowed: false, reason: read.error ?? 'Die aktuellen Berechtigungen sind noch nicht bestätigt.' },
    hasModuleGate: (moduleKey: import('@/types').ProductKey) => isConfirmed() && !!tenantId && hasEffectiveModuleGateAccess(moduleKey, tenantId),
    isReadOnly: grants().includes('office.clients.view') && !grants().includes('office.clients.edit'),
    loading: read.status === 'loading' || (enabled && (auth.isLoading || !auth.authReady))
      || (!!expiredSession && !renewalFailed),
    error: renewalFailed ? 'Die Anmeldung konnte nicht erneuert werden. Bitte erneut versuchen.' : read.error,
    refreshPermissions,
  };
}
