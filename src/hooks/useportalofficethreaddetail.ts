import { useCallback, useEffect, useState } from 'react';
import {
  fetchPortalOfficeThreadDetail,
  resolvePortalActor,
  sendPortalOfficeMessage,
  startNewPortalThreadFromClosed,
} from '@/lib/office/portalofficemessageservice';
import type { OfficeMessageThreadDetail } from '@/types/office/messaging';
import type { PendingMessageAttachment } from '@/lib/office/messageattachmentvalidation';
import { markPortalThreadMessagesRead } from '@/lib/office/messagereadservice';
import { subscribeToOfficeMessageThread } from '@/lib/office/officemessagerealtime';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function usePortalOfficeThreadDetail(threadId: string | null) {
  const { profile, portalSession } = useAuth();
  const tenantId = useServiceTenantId();
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !threadId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Chat ausgewählt.' });
      }
      const actorResult = resolvePortalActor(
        profile?.roleKey ?? portalSession?.roleKey ?? null,
        portalSession,
        profile?.id ?? portalSession?.accountId,
        profile?.displayName,
      );
      if (!actorResult.ok) return Promise.resolve(actorResult);
      return fetchPortalOfficeThreadDetail(tenantId, threadId, actorResult.data);
    },
    [tenantId, threadId, profile?.roleKey, profile?.id, profile?.displayName, portalSession],
    { enabled: !!tenantId && !!threadId },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  useEffect(() => {
    if (!tenantId || !threadId) return;
    const unsubscribe = subscribeToOfficeMessageThread(tenantId, threadId, () => {
      void query.refresh();
    });
    return unsubscribe;
  }, [tenantId, threadId, query]);

  const markAsRead = useCallback(async () => {
    if (!tenantId || !threadId) return;
    const actorResult = resolvePortalActor(
      profile?.roleKey ?? portalSession?.roleKey ?? null,
      portalSession,
      profile?.id ?? portalSession?.accountId,
      profile?.displayName,
    );
    if (!actorResult.ok) return;
    await markPortalThreadMessagesRead(tenantId, threadId, actorResult.data);
    await refresh();
  }, [tenantId, threadId, profile, portalSession, refresh]);

  const sendMessage = useCallback(
    async (body: string, attachments: PendingMessageAttachment[] = []) => {
      if (!tenantId || !threadId) return { ok: false as const, error: 'Kein Chat ausgewählt.' };
      const actorResult = resolvePortalActor(
        profile?.roleKey ?? portalSession?.roleKey ?? null,
        portalSession,
        profile?.id ?? portalSession?.accountId,
        profile?.displayName,
      );
      if (!actorResult.ok) return actorResult;

      setSending(true);
      setSendError(null);
      const result = await sendPortalOfficeMessage(
        tenantId,
        threadId,
        actorResult.data,
        body,
        attachments,
      );
      setSending(false);
      if (!result.ok) {
        setSendError(result.error);
        return result;
      }
      await refresh();
      return result;
    },
    [tenantId, threadId, profile, portalSession, refresh],
  );

  const startNewChat = useCallback(async () => {
    if (!tenantId || !threadId) return { ok: false as const, error: 'Kein Chat ausgewählt.' };
    const actorResult = resolvePortalActor(
      profile?.roleKey ?? portalSession?.roleKey ?? null,
      portalSession,
      profile?.id ?? portalSession?.accountId,
      profile?.displayName,
    );
    if (!actorResult.ok) return actorResult;

    const result = await startNewPortalThreadFromClosed(tenantId, threadId, actorResult.data);
    if (result.ok) await refresh();
    return result;
  }, [tenantId, threadId, profile, portalSession, refresh]);

  return {
    detail: query.data as OfficeMessageThreadDetail | undefined,
    loading: query.loading,
    error: query.error ?? sendError,
    refreshing: query.refreshing,
    sending,
    refresh,
    sendMessage,
    startNewChat,
    markAsRead,
  };
}
