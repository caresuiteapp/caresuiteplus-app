import { withMessagingTimeout } from '@/lib/office/voicemessageutils';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ServiceResult } from '@/types';
import type { OfficeMessageAudience } from '@/types/office/messaging';
import { CONVERSATION_PAGE_SIZE, loadConversations, type MessagingActor, type ConversationPage, type MessageOperation } from '@/lib/office/messageWorkspaceService.web';
import { subscribeToOfficeMessageInbox } from '@/lib/office/officemessagerealtime';
import type { PendingMessageAttachment } from '@/lib/office/messageattachmentvalidation';

export type MessageDraft = { text: string; internal: boolean; attachments: PendingMessageAttachment[]; operation?: MessageOperation; error?: string };
export const emptyMessageDraft = (): MessageDraft => ({ text: '', internal: false, attachments: [] });
export const hasMessageDraft = (draft?: MessageDraft) => !!draft && (!!draft.text.trim() || !!draft.attachments.length || !!draft.operation);
export const messagingScope = (actor: MessagingActor) => `${actor.tenantId}:${actor.profileId}:${actor.roleKey}`;

/** Scope-tagged results prevent old tenant, thread or recipient requests appearing in a new view. */
export function useMessageResource<T>(key: string, loader: () => Promise<ServiceResult<T>>) {
  const loaderRef = useRef(loader); loaderRef.current = loader;
  const keyRef = useRef(key); keyRef.current = key;
  const request = useRef(0);
  const alive = useRef(true);
  const [state, setState] = useState<{ key: string; data?: T; error?: string; loading: boolean }>({ key, loading: true });
  const refresh = useCallback(async () => {
    const ticket = ++request.current;
    setState(previous => ({ key, data: previous.key === key ? previous.data : undefined, loading: true }));
    try {
      const result = await withMessagingTimeout(loaderRef.current(), 20000, 'Daten konnten nicht rechtzeitig geladen werden.');
      if (!alive.current || keyRef.current !== key || request.current !== ticket) return;
      setState(previous => result.ok ? { key, data: result.data, loading: false } : { key, data: previous.key === key ? previous.data : undefined, error: result.error, loading: false });
    } catch {
      if (alive.current && keyRef.current === key && request.current === ticket) setState(previous => ({ key, data: previous.key === key ? previous.data : undefined, error: 'Die Daten konnten nicht geladen werden. Bitte erneut versuchen.', loading: false }));
    }
  }, [key]);
  useEffect(() => { alive.current = true; void refresh(); return () => { alive.current = false; request.current += 1; }; }, [refresh]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : undefined, loading: state.key !== key || state.loading, refresh };
}

export function useConversationList(actor: MessagingActor, audience: OfficeMessageAudience) {
  const [pageCount, setPageCount] = useState(1);
  const scope = `${messagingScope(actor)}:${audience}`;
  const previousScope = useRef(scope);
  const requestedPages = previousScope.current === scope ? pageCount : 1;
  useEffect(() => { previousScope.current = scope; setPageCount(1); }, [scope]);
  const resource = useMessageResource<ConversationPage>(scope, async () => {
    const items: ConversationPage['items'] = [];
    let page: ConversationPage = { items: [], hasMore: false, nextOffset: 0 };
    for (let index = 0; index < requestedPages; index++) {
      const result = await loadConversations(actor, audience, index * CONVERSATION_PAGE_SIZE);
      if (!result.ok) return result;
      page = result.data; items.push(...page.items);
      if (!page.hasMore) break;
    }
    return { ok: true, data: { ...page, items: [...new Map(items.map(item => [item.id, item])).values()] } };
  });
  const refresh = resource.refresh;
  useEffect(() => { if (pageCount > 1) void refresh(); }, [pageCount, refresh]);
  useEffect(() => {
    if (!actor.tenantId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToOfficeMessageInbox(actor.tenantId, () => { clearTimeout(timer); timer = setTimeout(() => void refresh(), 250); });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [actor.tenantId, refresh]);
  return { ...resource, loadMore: () => { if (!resource.loading) setPageCount(count => count + 1); } };
}
