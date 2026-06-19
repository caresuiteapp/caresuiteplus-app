import { useCallback, useEffect, useState } from 'react';
import type { OfficeMessageThreadDetail } from '@/types/office/messaging';
import type { PendingMessageAttachment } from '@/lib/office/messageattachmentvalidation';
import {
  fetchOfficeMessageThreadDetail,
  sendOfficeMessage,
  startNewOfficeThreadFromClosed,
} from '@/lib/office/messageservice';
import { patchOfficeMessageThread } from '@/lib/office/messagethreadservice';
import type { OfficeMessagePriority, OfficeThreadStatus } from '@/types/office/messaging';
import { markOfficeThreadMessagesRead } from '@/lib/office/messagereadservice';
import { subscribeToOfficeMessageThread } from '@/lib/office/officemessagerealtime';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from './core';

export function useOfficeMessageThreadDetail(threadId: string | null) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !threadId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Chat ausgewählt.' });
      }
      return fetchOfficeMessageThreadDetail(tenantId, threadId, profile?.roleKey, profile?.id);
    },
    [tenantId, threadId, profile?.roleKey, profile?.id],
    { enabled: !!tenantId && !!threadId },
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

  const sendMessage = useCallback(
    async (
      body: string,
      options?: { isInternalNote?: boolean; attachments?: PendingMessageAttachment[] },
    ) => {
      if (!tenantId || !threadId) return { ok: false as const, error: 'Kein Chat ausgewählt.' };
      setSending(true);
      setSendError(null);
      const result = await sendOfficeMessage(
        tenantId,
        threadId,
        body,
        profile?.roleKey,
        profile?.id,
        options,
      );
      setSending(false);
      if (!result.ok) {
        setSendError(result.error);
        return result;
      }
      await refresh();
      return result;
    },
    [tenantId, threadId, profile?.roleKey, profile?.id, refresh],
  );

  const startNewChat = useCallback(async () => {
    if (!tenantId || !threadId) return { ok: false as const, error: 'Kein Chat ausgewählt.' };
    const result = await startNewOfficeThreadFromClosed(
      threadId,
      tenantId,
      profile?.roleKey,
      profile?.id,
    );
    return result;
  }, [tenantId, threadId, profile?.roleKey, profile?.id]);

  const markAsRead = useCallback(async () => {
    if (!tenantId || !threadId || !profile?.id) return;
    await markOfficeThreadMessagesRead(tenantId, threadId, profile.id);
    await refresh();
  }, [tenantId, threadId, profile?.id, refresh]);

  const updateStatus = useCallback(
    async (status: OfficeThreadStatus) => {
      if (!tenantId || !threadId) return { ok: false as const, error: 'Kein Chat ausgewählt.' };
      const result = await patchOfficeMessageThread(
        tenantId,
        threadId,
        { status },
        profile?.roleKey,
        profile?.id,
      );
      if (result.ok) await refresh();
      return result;
    },
    [tenantId, threadId, profile?.roleKey, profile?.id, refresh],
  );

  const assignSelf = useCallback(async () => {
    if (!tenantId || !threadId || !profile?.id) {
      return { ok: false as const, error: 'Kein Profil für Zuweisung.' };
    }
    const result = await patchOfficeMessageThread(
      tenantId,
      threadId,
      { assignedToUserId: profile.id },
      profile.roleKey,
      profile.id,
    );
    if (result.ok) await refresh();
    return result;
  }, [tenantId, threadId, profile?.id, profile?.roleKey, refresh]);

  const updatePriority = useCallback(
    async (priority: OfficeMessagePriority) => {
      if (!tenantId || !threadId) return { ok: false as const, error: 'Kein Chat ausgewählt.' };
      const result = await patchOfficeMessageThread(
        tenantId,
        threadId,
        { priority },
        profile?.roleKey,
        profile?.id,
      );
      if (result.ok) await refresh();
      return result;
    },
    [tenantId, threadId, profile?.roleKey, profile?.id, refresh],
  );

  const updateCategory = useCallback(
    async (categoryId: string) => {
      if (!tenantId || !threadId) return { ok: false as const, error: 'Kein Chat ausgewählt.' };
      const result = await patchOfficeMessageThread(
        tenantId,
        threadId,
        { categoryId },
        profile?.roleKey,
        profile?.id,
      );
      if (result.ok) await refresh();
      return result;
    },
    [tenantId, threadId, profile?.roleKey, profile?.id, refresh],
  );

  return {
    detail: query.data as OfficeMessageThreadDetail | undefined,
    loading: query.loading,
    error: query.error ?? sendError,
    refreshing: query.refreshing,
    previewData: query.previewData,
    sending,
    refresh,
    sendMessage,
    startNewChat,
    markAsRead,
    updateStatus,
    assignSelf,
    updatePriority,
    updateCategory,
  };
}
