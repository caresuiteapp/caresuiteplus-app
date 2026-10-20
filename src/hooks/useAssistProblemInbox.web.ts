import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchAssistProblemSnapshot, type AssistProblemSnapshot } from '@/lib/assist/assistProblemWorkspaceService.web';

type State = { key: string; snapshot: AssistProblemSnapshot | null; busy: boolean; error: string | null };

/** Identity and request guards prevent a late response exposing another tenant's inbox. */
export function useAssistProblemInbox({ enabled = true, refreshToken = 0 }: { enabled?: boolean; refreshToken?: number } = {}) {
  const tenantId = useServiceTenantId();
  const { profile, user } = useAuth();
  const { roleKey, permissions } = usePermissions();
  const permissionKey = [...permissions].sort().join('|');
  const key = JSON.stringify([tenantId, profile?.id, user?.id, roleKey, permissionKey, enabled]);
  const activeKey = useRef(key);
  activeKey.current = key;
  const generation = useRef(0);
  const mounted = useRef(true);
  const [state, setState] = useState<State>({ key, snapshot: null, busy: false, error: null });
  const stateRef = useRef(state);
  stateRef.current = state;
  const refresh = useCallback(async (): Promise<AssistProblemSnapshot | null> => {
    const request = ++generation.current;
    if (!enabled || !tenantId || !profile?.id) {
      setState({ key, snapshot: null, busy: false, error: enabled ? 'Bitte ein Unternehmen mit gültigem Zugang auswählen.' : null });
      return null;
    }
    setState(current => ({ key, snapshot: current.key === key ? current.snapshot : null, busy: true, error: null }));
    try {
      const result = await fetchAssistProblemSnapshot(tenantId, { roleKey, permissions, profileId: profile.id });
      if (!mounted.current || activeKey.current !== key || generation.current !== request) return null;
      if (!result.ok) {
        setState(current => ({ key, snapshot: current.key === key ? current.snapshot : null, busy: false, error: result.error }));
        return null;
      }
      const previous = stateRef.current.key === key ? stateRef.current.snapshot : null;
      const snapshot = result.data.complete || !previous ? result.data : {
        ...result.data,
        items: [...result.data.items, ...previous.items.filter(item => !result.data.items.some(current => current.id === item.id)).map(item => ({ ...item, unverified: true }))],
      };
      setState({ key, snapshot, busy: false, error: null });
      return snapshot;
    } catch {
      if (mounted.current && activeKey.current === key && generation.current === request) setState(current => ({ key, snapshot: current.key === key ? current.snapshot : null, busy: false, error: 'Die Problem-Inbox konnte nicht aktualisiert werden. Bitte erneut versuchen.' }));
      return null;
    }
    // The serialized permissions are part of the identity; avoid array-reference reload loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  useEffect(() => { void refresh(); }, [refresh, refreshToken]);
  const current = state.key === key ? state : { key, snapshot: null, busy: enabled, error: null };
  return { snapshot: current.snapshot, loading: current.busy && !current.snapshot,
    refreshing: current.busy && !!current.snapshot, error: current.error, refresh };
}
