import type { KIMMessage, KIMMessageListItem } from '@/types/modules/ti';

export interface KIMProviderAdapter {
  syncMailbox(mailboxId: string): Promise<{ synced: number; errors: string[] }>;
  fetchMessages(mailboxId: string): Promise<KIMMessageListItem[]>;
  fetchMessageDetail(messageId: string): Promise<KIMMessage | null>;
}

export interface TIConnectorAdapter {
  checkConnection(providerId: string): Promise<{ ok: boolean; message: string }>;
}
