import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableServiceError } from '@/lib/supabase/errors';

export type OfficeMessageNotificationType =
  | 'office_message_new'
  | 'office_message_status'
  | 'office_message_reply';

type NotificationInput = {
  tenantId: string;
  type: OfficeMessageNotificationType;
  threadId: string;
  title: string;
  body: string;
};

/** Erstellt Benachrichtigung ohne sensible Inhalte — schlägt still fehl wenn Tabelle fehlt. */
export async function notifyOfficeMessageEvent(
  input: NotificationInput,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: undefined };

  try {
    const { error } = await supabase.from('communication_notifications').insert({
      tenant_id: input.tenantId,
      type: input.type,
      thread_id: input.threadId,
      title: input.title,
      body: input.body,
    });
    if (error) {
      if (isMissingTableServiceError(error.message)) {
        return { ok: true, data: undefined };
      }
      return { ok: false, error: error.message };
    }

    // FCM-Versand vorbereitet — noch kein Push-Infrastruktur-Backend
    void enqueueOfficeMessagePushStub(input);

    return { ok: true, data: undefined };
  } catch {
    return { ok: true, data: undefined };
  }
}

/** Stub für künftigen FCM/Push-Versand — protokolliert nur den Intent. */
export async function enqueueOfficeMessagePushStub(input: NotificationInput): Promise<void> {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.info('[office-push-stub]', input.type, input.threadId);
  }
}

export function buildNewMessageNotification(): { title: string; body: string } {
  return {
    title: 'Neue Nachricht',
    body: 'Neue Nachricht in CareSuite+',
  };
}

export function buildStatusChangeNotification(statusLabel: string): { title: string; body: string } {
  return {
    title: 'Chat-Status aktualisiert',
    body: `Status: ${statusLabel}`,
  };
}
