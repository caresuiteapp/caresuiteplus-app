import { useRef } from 'react';
import type { PortalContext } from '@/lib/portal/types';
import { resolvePortalContext } from '@/lib/portal/engine/resolvePortalContext';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { sharedPortalRead } from '@/lib/portal/sharedPortalRead';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';

export type PortalContextState = {
  context: PortalContext | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isReady: boolean;
};

export function usePortalContext(): PortalContextState {
  const { tenantId, clientId, roleKey, actorId, displayName, isReady: actorReady, isResolvingClientLink } = usePortalActor();
  const { portalSession } = useAuth();
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;
  const key = JSON.stringify([tenantId, clientId, roleKey, actorId, portalSession?.accountId, portalSession?.tenantName]);
  const query = useAsyncQuery(async () => {
    const context = await sharedPortalRead(`context:${key}`, () => resolvePortalContext({
      tenantId: tenantId!, clientId: clientId!, roleKey: roleKey!,
      displayName: displayNameRef.current, tenantNameHint: portalSession?.tenantName ?? null,
    }));
    return { ok: true as const, data: context };
  }, [key], { enabled: actorReady && !!tenantId && !!roleKey && !!clientId, queryKey: key });
  return {
    context: query.data,
    loading: !actorReady || isResolvingClientLink || query.loading,
    error: actorReady && !isResolvingClientLink && !clientId
      ? 'Kein Klientenprofil verknüpft. Bitte melden Sie sich erneut an.'
      : query.error ? toPortalUserFacingError(query.error, 'Ihre Übersicht konnte gerade nicht geladen werden.') : null,
    refresh: query.refresh,
    isReady: actorReady && query.data !== null,
  };
}
