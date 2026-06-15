import { useCallback } from 'react';
import { fetchOfficeMessageDetail, replyToOfficeMessage } from '@/lib/portal/messageService';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery, useMutation } from './core';

export function useOfficeMessageDetail(messageId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!messageId) {
        return Promise.resolve({
          ok: false as const,
          error: 'Keine Nachrichten-ID angegeben.',
        });
      }
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchOfficeMessageDetail(messageId, tenantId, roleKey);
    },
    [messageId, tenantId, roleKey],
    { enabled: Boolean(messageId) && !!tenantId },
  );

  const replyMutation = useMutation(
    (body: string) =>
      replyToOfficeMessage(
        messageId ?? '',
        tenantId ?? '',
        roleKey,
        body,
        profile?.displayName ?? undefined,
      ),
    { successMessage: 'Antwort gesendet.' },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  const reply = useCallback(
    async (body: string) => {
      const result = await replyMutation.mutate(body);
      if (result) await query.refresh();
      return result;
    },
    [replyMutation, query],
  );

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
    reply,
    replyLoading: replyMutation.loading,
    replyError: replyMutation.error,
    successMessage: replyMutation.successMessage,
    notFound: !query.loading && !query.error && !query.data && !!messageId,
  };
}
