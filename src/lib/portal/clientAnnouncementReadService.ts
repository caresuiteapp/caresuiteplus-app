import type { ServiceResult } from '@/types';
import type { AppNotification } from '@/types/office/broadcast';
import { fetchBroadcastForNotification, markNotificationRead } from '@/lib/office/notificationservice';

/** A preview is never a successful full read; respect the broadcast's live RLS scope. */
export async function readClientPortalAnnouncement(
  tenantId: string,
  userId: string,
  item: AppNotification,
): Promise<ServiceResult<{ body: string; readWarning: string | null }>> {
  if (!item.relatedBroadcastId) return { ok: false, error: 'Der Volltext dieser Mitteilung ist nicht mehr verfügbar.' };
  try {
    const detail = await fetchBroadcastForNotification(tenantId, item.relatedBroadcastId);
    if (!detail.ok) return { ok: false, error: 'Diese Mitteilung ist nicht mehr freigegeben oder konnte gerade nicht geladen werden. Bitte versuchen Sie es erneut.' };
    let readWarning: string | null = null;
    if (!item.isRead) {
      try {
        const read = await markNotificationRead(tenantId, item.id, userId);
        if (!read.ok) readWarning = 'Die Mitteilung wurde geöffnet. Der Lesestatus konnte gerade nicht gespeichert werden.';
      } catch {
        readWarning = 'Die Mitteilung wurde geöffnet. Der Lesestatus konnte gerade nicht gespeichert werden.';
      }
    }
    return { ok: true, data: { body: detail.data.body, readWarning } };
  } catch {
    return { ok: false, error: 'Die Mitteilung konnte gerade nicht geöffnet werden. Bitte versuchen Sie es erneut.' };
  }
}
