import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchSubscriptionWorkspace, type SubscriptionWorkspaceErrorCode, type SubscriptionWorkspaceSnapshot } from '@/lib/business/subscriptionWorkspaceService.web';

type State = {
  identityKey: string;
  data: SubscriptionWorkspaceSnapshot | null;
  loading: boolean;
  error: string | null;
  errorCode: SubscriptionWorkspaceErrorCode | null;
};

export function useSubscriptionWorkspace() {
  const { authReady, isAuthenticated, user, profile, portalSession, profileBootstrapError } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = resolveEffectiveRoleKey(profile, user, portalSession);
  const hasPortalSession = Boolean(portalSession);
  const authUserId = user?.id ?? '';
  const profileId = profile?.id ?? '';
  const identityKey = JSON.stringify([authUserId, profileId, tenantId, roleKey, authReady, isAuthenticated, Boolean(portalSession), portalSession?.roleKey ?? null, profileBootstrapError]);
  const sequence = useRef(0);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<State>({ identityKey, data: null, loading: true, error: null, errorCode: null });
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    let alive = true;
    const request = ++sequence.current;
    if (!authReady) {
      setState({ identityKey, data: null, loading: true, error: null, errorCode: null });
      return () => { alive = false; };
    }
    if (!isAuthenticated || !authUserId || !profileId || !tenantId || profileBootstrapError || hasPortalSession) {
      setState({ identityKey, data: null, loading: false, error: 'Für diese Übersicht benötigen Sie ein angemeldetes Verwaltungskonto mit zugeordnetem Unternehmen.', errorCode: 'identity' });
      return () => { alive = false; };
    }
    setState(previous => ({ identityKey, data: previous.identityKey === identityKey ? previous.data : null, loading: true, error: null, errorCode: null }));
    void fetchSubscriptionWorkspace({ authUserId, profileId, tenantId, roleKey }).then(result => {
      if (!alive || request !== sequence.current) return;
      setState(previous => ({
        identityKey, loading: false,
        data: result.ok ? result.data : result.code === 'connection' && previous.identityKey === identityKey ? previous.data : null,
        error: result.ok ? null : result.error,
        errorCode: result.ok ? null : result.code,
      }));
    }).catch(() => {
      if (!alive || request !== sequence.current) return;
      setState(previous => ({ identityKey, loading: false, data: previous.identityKey === identityKey ? previous.data : null, error: 'Die Übersicht konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.', errorCode: 'connection' }));
    });
    return () => { alive = false; };
  }, [authReady, isAuthenticated, authUserId, profileId, tenantId, roleKey, hasPortalSession, profileBootstrapError, identityKey, revision]);

  // Render-time masking avoids even one frame of another account's prior response.
  const current = state.identityKey === identityKey ? state : { identityKey, data: null, loading: true, error: null, errorCode: null };
  return { ...current, tenantId, roleKey, refresh };
}
