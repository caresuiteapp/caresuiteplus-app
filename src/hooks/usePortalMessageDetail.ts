import { useCallback } from 'react';
import { fetchPortalMessageDetail, replyToPortalMessage } from '@/lib/portal';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery, useMutation } from './core';

export function usePortalMessageDetail(messageId: string | undefined) {
  const { profile } = useAuth();
  const profileId = profile?.id ?? '';
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => fetchPortalMessageDetail(messageId ?? '', profileId, roleKey),
    [messageId, profileId, roleKey],
    { enabled: !!messageId && !!profileId && !!roleKey },
  );

  const replyMutation = useMutation(
    (body: string) => replyToPortalMessage(messageId ?? '', profileId, roleKey, body),
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
