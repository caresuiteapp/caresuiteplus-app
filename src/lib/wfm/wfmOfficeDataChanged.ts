import { getRealtimeSubscription } from '@/lib/realtime/channelManager';

/** Refresh open Office views immediately after a confirmed write. */
export function notifyWfmOfficeDataChanged(tenantId: string): void {
  const subscription = getRealtimeSubscription(`wfm-live:${tenantId}`);
  for (const handler of subscription?.handlers ?? []) {
    // A refresh listener must never turn a successful save into a failed save.
    try { handler(); } catch { /* Each query presents its own refresh error. */ }
  }
}
