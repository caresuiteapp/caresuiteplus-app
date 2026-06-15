import type { KIMProviderAdapter } from './types';
import {
  getKIMMessageDetail,
  getKIMMessages,
  toKIMMessageListItem,
} from '@/data/demo/ti';

/** Demo-Adapter — ersetzt später Edge Function ti-provider-proxy */
export class MockKIMProvider implements KIMProviderAdapter {
  async syncMailbox(_mailboxId: string): Promise<{ synced: number; errors: string[] }> {
    await new Promise((r) => setTimeout(r, 300));
    return { synced: getKIMMessages().length, errors: [] };
  }

  async fetchMessages(_mailboxId: string) {
    await new Promise((r) => setTimeout(r, 150));
    return getKIMMessages().map(toKIMMessageListItem);
  }

  async fetchMessageDetail(messageId: string) {
    await new Promise((r) => setTimeout(r, 120));
    return getKIMMessageDetail(messageId);
  }
}

export const mockKIMProvider = new MockKIMProvider();
