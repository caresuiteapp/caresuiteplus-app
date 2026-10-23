import { useEffect, useMemo, useRef, useState } from 'react';
import type { RoleKey, ServiceResult } from '@/types';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';
import { usePermissions } from '@/hooks/usePermissions';
import { confirmQmReadScope, type QmReadScope } from '@/lib/qm/confirmQmReadScope.web';
import { isDemoMode } from '@/lib/supabase/config';

/** Web QM reads stay bound to the currently confirmed business identity. */
export function useQmTenantQuery<T>(
  fetcher: (tenantId: string, roleKey: RoleKey | null) => Promise<ServiceResult<T>>,
  deps: unknown[] = [],
) {
  const auth = useAuth();
  const tenantId = useServiceTenantId();
  const runtime = usePermissions();
  const demo = isDemoMode();
  const roleKey = runtime.roleKey;
  const [revision, setRevision] = useState(0);
  const [suspended, setSuspended] = useState(() => typeof document !== 'undefined' && document.visibilityState === 'hidden');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const resume = () => {
      if (document.visibilityState === 'hidden') return;
      setSuspended(false); setRevision(value => value + 1);
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') setSuspended(true);
      else resume();
    };
    const hide = () => setSuspended(true);
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', visibility);
      window.addEventListener('focus', resume);
      window.addEventListener('pageshow', resume);
      window.addEventListener('pagehide', hide);
      window.addEventListener('online', resume);
    }
    return () => {
      mounted.current = false;
      if (typeof document === 'undefined' || typeof window === 'undefined') return;
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', resume);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('online', resume);
    };
  }, []);
  useEffect(() => {
    const expiresAt = auth.session?.expiresAt;
    if (demo || expiresAt === null || expiresAt === undefined || !Number.isFinite(expiresAt)) return;
    const timer = setTimeout(() => setRevision(value => value + 1), Math.min(2_147_483_647, Math.max(0, expiresAt - Date.now())));
    return () => clearTimeout(timer);
  }, [auth.session?.expiresAt, demo]);
  const allowed = Boolean(!suspended && tenantId && auth.profile && roleKey && !auth.portalSession
    && auth.profile.tenantId === tenantId && auth.profile.roleKey === roleKey && runtime.can('qm.view')
    && (demo || (auth.authReady && auth.isAuthenticated && !auth.isLoading && !auth.profileBootstrapError
      && auth.user && auth.session && auth.session.user.id === auth.user.id && auth.session.accessToken
      && (auth.session.expiresAt === null || auth.session.expiresAt > Date.now()))));
  const scope: QmReadScope | null = allowed && tenantId && auth.profile && roleKey ? {
    tenantId, profileId: auth.profile.id, authUserId: auth.user?.id ?? '', roleKey,
    accessToken: auth.session?.accessToken ?? '', expiresAt: auth.session?.expiresAt ?? null,
  } : null;
  const sequence = useRef(0);
  // Credentials are dependencies only; they are never placed in a query key or public error.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const generation = useMemo(() => ({ scope, permissions: runtime.permissions, allowed, demo, confirmationError: null as string | null, serial: ++sequence.current }), [
    tenantId, scope?.profileId, scope?.authUserId, scope?.roleKey, scope?.accessToken, scope?.expiresAt,
    demo, runtime.permissions, allowed, revision, ...deps,
  ]);
  const current = useRef(generation);
  current.current = generation;
  const canRead = () => mounted.current && current.current === generation && generation.allowed && !!generation.scope
    && (generation.demo || generation.scope.expiresAt === null || generation.scope.expiresAt > Date.now());
  const query = useAsyncQuery(
    async () => {
      if (!canRead() || !generation.scope) return { ok: false as const, error: 'Der aktuelle QM-Zugriff ist nicht bestätigt.' };
      if (!generation.demo) {
        const confirmed = await confirmQmReadScope(generation.scope, canRead);
        if (!confirmed.ok) {
          if (current.current === generation) generation.confirmationError = confirmed.error;
          return confirmed;
        }
        if (!canRead()) return { ok: false as const, error: 'Der aktuelle QM-Zugriff ist nicht bestätigt.' };
        generation.confirmationError = null;
      }
      const result = await fetcher(generation.scope.tenantId, generation.scope.roleKey);
      if (!canRead()) return { ok: false as const, error: 'Konto, Mandant oder Berechtigungen wurden geändert. Bitte erneut laden.' };
      return result;
    },
    [generation],
    { enabled: allowed, queryKey: `qm-current-${generation.serial}` },
  );
  const checking = auth.isLoading || suspended;
  const accessError = checking ? null : !tenantId
    ? 'Kein Mandant am angemeldeten Konto hinterlegt.'
    : !allowed
      ? runtime.check('qm.view').reason ?? 'Der aktuelle QM-Zugriff ist nicht bestätigt.'
      : null;
  return {
    ...query,
    data: canRead() && !generation.confirmationError ? query.data : null,
    loading: checking || (allowed && query.loading),
    error: accessError ?? generation.confirmationError ?? query.error,
    refresh: async () => {
      if (!allowed) return;
      await query.refresh();
    },
  };
}
