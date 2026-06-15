import type { RoleKey, ServiceResult } from '@/types';
import { appendDemoReaction, getDemoReactions } from './communication.demoStore';
import { DEFAULT_EMOJIS } from './communication.constants';
import type { MessageReaction } from './communication.types';
import type { MessageSenderType } from './communication.types';

export function listDefaultEmojis(): readonly string[] {
  return DEFAULT_EMOJIS;
}

export async function addReaction(
  tenantId: string,
  threadId: string,
  messageId: string,
  emoji: string,
  reactedByType: MessageSenderType,
  reactedById: string | null,
  reactedByDisplayName: string,
): Promise<ServiceResult<MessageReaction>> {
  const existing = getDemoReactions().find(
    (r) =>
      r.messageId === messageId &&
      r.emoji === emoji &&
      r.reactedById === reactedById &&
      r.reactedByType === reactedByType,
  );
  if (existing) return { ok: true, data: existing };

  const now = new Date().toISOString();
  const reaction: MessageReaction = {
    id: `react-${Date.now()}`,
    tenantId,
    threadId,
    messageId,
    emoji,
    reactedByType,
    reactedById,
    reactedByDisplayName,
    createdAt: now,
    updatedAt: now,
  };
  appendDemoReaction(reaction);
  return { ok: true, data: reaction };
}

export async function removeReaction(reactionId: string): Promise<ServiceResult<{ removed: true }>> {
  const index = getDemoReactions().findIndex((r) => r.id === reactionId);
  if (index < 0) return { ok: false, error: 'Reaktion nicht gefunden.' };
  getDemoReactions().splice(index, 1);
  return { ok: true, data: { removed: true } };
}

export function listMessageReactions(messageId: string): MessageReaction[] {
  return getDemoReactions().filter((r) => r.messageId === messageId);
}

export type GroupedReaction = { emoji: string; count: number; reactionIds: string[] };

export function groupReactions(reactions: MessageReaction[]): GroupedReaction[] {
  const map = new Map<string, GroupedReaction>();
  for (const reaction of reactions) {
    const existing = map.get(reaction.emoji);
    if (existing) {
      existing.count += 1;
      existing.reactionIds.push(reaction.id);
    } else {
      map.set(reaction.emoji, { emoji: reaction.emoji, count: 1, reactionIds: [reaction.id] });
    }
  }
  return [...map.values()];
}
