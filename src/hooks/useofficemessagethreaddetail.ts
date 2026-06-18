import { useCallback, useEffect, useState } from 'react';
import type { OfficeMessageThreadDetail } from '@/types/office/messaging';
import type { PendingMessageAttachment } from '@/lib/office/messageattachmentvalidation';
import {
  fetchOfficeMessageThreadDetail,
  sendOfficeMessage,
  startNewOfficeThreadFromClosed,
} from '@/lib/office/messageservice';
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
      void query.refresh();
    });
    return unsubscribe;
  }, [tenantId, threadId, query]);

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

  const updateStatus = useCallback(async (_status: string) => {
    return { ok: false as const, error: 'Statusänderung noch nicht wiederhergestellt.' };
  }, []);

  const assignSelf = useCallback(async () => {
    return { ok: false as const, error: 'Zuweisung noch nicht wiederhergestellt.' };
  }, []);

  const updatePriority = useCallback(async (_priority: string) => {
    return { ok: false as const, error: 'Priorität noch nicht wiederhergestellt.' };
  }, []);

  const updateCategory = useCallback(async (_categoryId: string) => {
    return { ok: false as const, error: 'Kategorie noch nicht wiederhergestellt.' };
  }, []);

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
