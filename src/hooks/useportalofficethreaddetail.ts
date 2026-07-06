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
import { toUserFacingSendError, VOICE_SEND_TIMEOUT_MS, withMessagingTimeout } from '@/lib/office/voicemessageutils';
import { useAuth } from '@/lib/auth/context';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function usePortalOfficeThreadDetail(threadId: string | null) {
  const { profile, portalSession } = useAuth();
  const tenantId = useServiceTenantId();
  const { clientId, employeeId, actorId, roleKey, displayName, isLinkedReady } = usePortalActor();
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const actorRoleKey = profile?.roleKey ?? roleKey ?? portalSession?.roleKey ?? null;
  const actorProfileId = profile?.id ?? actorId ?? portalSession?.accountId ?? null;
  const actorDisplayName = profile?.displayName ?? displayName ?? null;
  const actorClientId = clientId ?? portalSession?.clientId ?? null;
  const actorEmployeeId = employeeId ?? portalSession?.employeeId ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !threadId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Chat ausgewählt.' });
      }
      const actorResult = resolvePortalActor(
        actorRoleKey,
        portalSession,
        actorProfileId,
        actorDisplayName,
        { clientId: actorClientId, employeeId: actorEmployeeId },
      );
      if (!actorResult.ok) return Promise.resolve(actorResult);
      return fetchPortalOfficeThreadDetail(tenantId, threadId, actorResult.data);
    },
    [tenantId, threadId, actorRoleKey, actorProfileId, actorDisplayName, actorClientId, actorEmployeeId],
    { enabled: !!tenantId && !!threadId && isLinkedReady },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  useEffect(() => {
    if (!tenantId || !threadId) return;
    const unsubscribe = subscribeToOfficeMessageThread(tenantId, threadId, () => {
      void refresh();
    });
    return unsubscribe;
  }, [tenantId, threadId, refresh]);

  const markAsRead = useCallback(async () => {
    if (!tenantId || !threadId) return;
    const actorResult = resolvePortalActor(
      actorRoleKey,
      portalSession,
      actorProfileId,
      actorDisplayName,
      { clientId: actorClientId, employeeId: actorEmployeeId },
    );
    if (!actorResult.ok) return;
    await markPortalThreadMessagesRead(tenantId, threadId, actorResult.data);
    await refresh();
  }, [
    tenantId,
    threadId,
    actorRoleKey,
    portalSession,
    actorProfileId,
    actorDisplayName,
    actorClientId,
    actorEmployeeId,
    refresh,
  ]);

  const sendMessage = useCallback(
    async (body: string, attachments: PendingMessageAttachment[] = []) => {
      if (!tenantId || !threadId) return { ok: false as const, error: 'Kein Chat ausgewählt.' };
      const actorResult = resolvePortalActor(
        actorRoleKey,
        portalSession,
        actorProfileId,
        actorDisplayName,
        { clientId: actorClientId, employeeId: actorEmployeeId },
      );
      if (!actorResult.ok) return actorResult;

      setSending(true);
      setSendError(null);
      let result: Awaited<ReturnType<typeof sendPortalOfficeMessage>>;
      try {
        result = await withMessagingTimeout(
          sendPortalOfficeMessage(tenantId, threadId, actorResult.data, body, attachments),
          VOICE_SEND_TIMEOUT_MS,
          'Send timeout',
        );
        if (!result.ok) {
          setSendError(toUserFacingSendError(result.error));
        }
      } catch {
        setSendError(toUserFacingSendError());
        result = { ok: false as const, error: toUserFacingSendError() };
      } finally {
        setSending(false);
      }
      if (result.ok) {
        void refresh();
      }
      return result;
    },
    [tenantId, threadId, actorRoleKey, portalSession, actorProfileId, actorDisplayName, actorClientId, actorEmployeeId, refresh],
  );

  const startNewChat = useCallback(async () => {
    if (!tenantId || !threadId) return { ok: false as const, error: 'Kein Chat ausgewählt.' };
    const actorResult = resolvePortalActor(
      actorRoleKey,
      portalSession,
      actorProfileId,
      actorDisplayName,
      { clientId: actorClientId, employeeId: actorEmployeeId },
    );
    if (!actorResult.ok) return actorResult;

    const result = await startNewPortalThreadFromClosed(tenantId, threadId, actorResult.data);
    if (result.ok) await refresh();
    return result;
  }, [
    tenantId,
    threadId,
    actorRoleKey,
    portalSession,
    actorProfileId,
    actorDisplayName,
    actorClientId,
    actorEmployeeId,
    refresh,
  ]);

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
