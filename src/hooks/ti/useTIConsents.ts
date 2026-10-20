import { useCallback, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  fetchTIConsents,
  grantTIConsentService,
  revokeTIConsentService,
} from '@/lib/ti';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

export function useTIConsents() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchTIConsents(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );

  const grantConsent = useCallback(
    async (consentId: string) => {
      if (!tenantId) return;
      const result = await grantTIConsentService(
        tenantId,
        consentId,
        profile?.displayName ?? 'System',
        profile?.roleKey,
      );
      setActionMessage(result.ok ? 'Einwilligung erteilt.' : result.error);
      if (result.ok) await query.refresh();
    },
    [tenantId, profile?.roleKey, profile?.displayName, query],
  );

  const revokeConsent = useCallback(
    async (consentId: string) => {
      if (!tenantId) return;
      const result = await revokeTIConsentService(
        tenantId,
        consentId,
        profile?.displayName ?? 'System',
        profile?.roleKey,
      );
      setActionMessage(result.ok ? 'Einwilligung widerrufen.' : result.error);
      if (result.ok) await query.refresh();
    },
    [tenantId, profile?.roleKey, profile?.displayName, query],
  );

  return {
    consents: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
    grantConsent,
    revokeConsent,
    actionMessage,
  };
}
