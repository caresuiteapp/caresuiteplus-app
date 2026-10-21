import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';
import { useServiceTenantId } from '@/hooks/useTenantId';
import type { ModuleAssignmentSection } from '@/lib/officeCore/types';
import {
  fetchModuleAssignmentWorkspace,
  type ModuleAssignmentWorkspaceSnapshot,
} from '@/lib/officeModules/moduleAssignmentWorkspaceService.web';

type State = {
  identityKey: string;
  data: ModuleAssignmentWorkspaceSnapshot | null;
  loading: boolean;
  error: string | null;
};

export function useModuleAssignmentWorkspace(section?: ModuleAssignmentSection) {
  const { authReady, isAuthenticated, user, profile, portalSession, profileBootstrapError } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = resolveEffectiveRoleKey(profile, user, portalSession);
  const authUserId = user?.id ?? '';
  const profileId = profile?.id ?? '';
  const hasPortalSession = Boolean(portalSession);
  const identityKey = JSON.stringify([authUserId, profileId, tenantId, roleKey, authReady, isAuthenticated, hasPortalSession, profileBootstrapError, section]);
  const sequence = useRef(0);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<State>({ identityKey, data: null, loading: true, error: null });
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    let alive = true;
    const request = ++sequence.current;
    if (!authReady) {
      setState({ identityKey, data: null, loading: true, error: null });
      return () => { alive = false; };
    }
    if (!isAuthenticated || !authUserId || !profileId || !tenantId || hasPortalSession || profileBootstrapError) {
      setState({ identityKey, data: null, loading: false, error: 'Bitte melden Sie sich mit einem Verwaltungskonto an und wählen Sie Ihr Unternehmen aus.' });
      return () => { alive = false; };
    }
    setState(previous => ({ identityKey, data: previous.identityKey === identityKey ? previous.data : null, loading: true, error: null }));
    void fetchModuleAssignmentWorkspace({ authUserId, profileId, tenantId, roleKey }, section).then(result => {
      if (!alive || request !== sequence.current) return;
      setState(previous => ({
        identityKey, loading: false,
        data: result.ok ? result.data : result.code === 'connection' && previous.identityKey === identityKey ? previous.data : null,
        error: result.ok ? null : result.error,
      }));
    }).catch(() => {
      if (!alive || request !== sequence.current) return;
      // An unexpected rejection carries no proof that the last access check ran.
      setState({ identityKey, loading: false, data: null, error: 'Die Zuordnungen konnten nicht aktualisiert werden. Bitte versuchen Sie es erneut.' });
    });
    return () => { alive = false; };
  }, [authReady, isAuthenticated, authUserId, profileId, tenantId, roleKey, hasPortalSession, profileBootstrapError, identityKey, section, revision]);

  // Returning from an editor in another browser tab must not leave old counts on screen.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  // Hide the old identity's data synchronously, before the next effect runs.
  const current = state.identityKey === identityKey ? state : { identityKey, data: null, loading: true, error: null };
  return { ...current, roleKey, refresh };
}
