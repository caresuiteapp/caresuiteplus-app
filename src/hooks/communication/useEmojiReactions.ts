import { useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  addReaction,
  groupReactions,
  listDefaultEmojis,
  listMessageReactions,
  removeReaction,
} from '@/features/communication/communication.emoji';

export function useEmojiReactions(threadId: string | undefined, messageId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const reactions = useMemo(
    () => (messageId ? listMessageReactions(messageId) : []),
    [messageId],
  );
  const grouped = useMemo(() => groupReactions(reactions), [reactions]);

  const toggleReaction = useCallback(
    async (emoji: string) => {
      if (!tenantId || !threadId || !messageId) return;
      const existing = reactions.find(
        (r) => r.emoji === emoji && r.reactedById === (profile?.id ?? null),
      );
      if (existing) {
        await removeReaction(existing.id);
        return;
      }
      await addReaction(
        tenantId,
        threadId,
        messageId,
        emoji,
        'business_user',
        profile?.id ?? null,
        profile?.displayName ?? 'Nutzer:in',
      );
    },
    [tenantId, threadId, messageId, profile?.id, profile?.displayName, reactions],
  );

  return {
    reactions,
    grouped,
    defaultEmojis: listDefaultEmojis(),
    toggleReaction,
  };
}
