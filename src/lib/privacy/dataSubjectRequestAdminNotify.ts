import type { ServiceResult } from '@/types';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import { isDataSubjectRequestBackendReady } from './dataRequestConfig';
import type { DataSubjectRequest } from './dataSubjectRequest.types';
import {
  DSGVO_ADMIN_NOTIFY_EDGE_FUNCTION,
  type AdminNotifyResult,
} from './dataSubjectRequestAdminNotifyHandler';

export type { AdminNotifyResult } from './dataSubjectRequestAdminNotifyHandler';

export const DSGVO_ADMIN_NOTIFY_PREPARED_MESSAGE =
  'Admin-E-Mail-Benachrichtigung ist code-ready (Edge Function). Versand erfordert deployte Function plus RESEND_API_KEY und DSGVO_NOTIFY_FROM_EMAIL — ohne Konfiguration nur prepared-only.';

/** Client-side: Edge Function aufrufbar wenn Live-Submit aktiv (kein service_role). */
export function isDataSubjectRequestAdminNotifyInvokable(): boolean {
  return isDataSubjectRequestBackendReady();
}

export async function notifyAdminsOfNewDataSubjectRequest(
  tenantId: string,
  request: DataSubjectRequest,
): Promise<ServiceResult<AdminNotifyResult>> {
  if (!isDataSubjectRequestAdminNotifyInvokable()) {
    return {
      ok: true,
      data: {
        status: 'prepared_only',
        recipientCount: 0,
        message: 'Admin-Benachrichtigung im Demo-Modus nicht aktiv.',
      },
    };
  }

  const invoke = await invokeEdgeFunction<AdminNotifyResult & { ok?: boolean }>(
    DSGVO_ADMIN_NOTIFY_EDGE_FUNCTION,
    {
      tenantId,
      requestId: request.id,
      requestType: request.requestType,
      requesterName: request.requesterName ?? '',
      requesterEmail: request.requesterEmail ?? '',
      receivedAt: request.receivedAt ?? request.createdAt,
    },
  );

  if (!invoke.ok) {
    return {
      ok: true,
      data: {
        status: 'prepared_only',
        recipientCount: 0,
        message: invoke.error,
      },
    };
  }

  const payload = invoke.data;
  return {
    ok: true,
    data: {
      status: payload.status ?? 'prepared_only',
      recipientCount: payload.recipientCount ?? 0,
      message: payload.message ?? DSGVO_ADMIN_NOTIFY_PREPARED_MESSAGE,
    },
  };
}
