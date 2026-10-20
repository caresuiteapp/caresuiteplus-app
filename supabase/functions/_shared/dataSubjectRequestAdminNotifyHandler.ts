import {
  type AdminNotifyDeliveryStatus,
  type AdminNotifyRequestPayload,
} from './dsgvoAdminNotify.ts';

export type DataRequestNotifyCaller = {
  authUserId: string;
  profileId: string;
  profileAuthUserId: string | null;
  tenantId: string;
  active: boolean;
  selfService: boolean;
  adminManage: boolean;
};

export type StoredDataRequestForNotify = {
  id: string;
  tenant_id: string;
  profile_id: string | null;
  request_type: string;
  requester_name: string | null;
  requester_email: string | null;
  received_at: string | null;
  created_at: string;
};

export type DataRequestNotifyDependencies = {
  resolveCaller(request: Request, tenantId: string): Promise<DataRequestNotifyCaller | null>;
  loadRequest(tenantId: string, requestId: string): Promise<StoredDataRequestForNotify | null>;
  isConfigured(): boolean;
  loadRecipients(tenantId: string): Promise<string[]>;
  claimDelivery(requestId: string): Promise<{ claimed: boolean; claimToken?: string }>;
  finishDelivery(requestId: string, claimToken: string, sent: boolean): Promise<void>;
  send(payload: AdminNotifyRequestPayload, recipients: string[]): Promise<{ ok: boolean }>;
};

export type DataRequestNotifyHttpResult = {
  statusCode: number;
  body: {
    ok: boolean;
    status?: AdminNotifyDeliveryStatus;
    message?: string;
    error?: string;
  };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_TYPES = new Set([
  'access', 'export', 'correction', 'deletion', 'restriction',
  'objection', 'portability', 'consent_withdrawal', 'other',
]);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The query already requires active profiles; this rejects foreign-tenant roles. */
export function collectScopedAdminProfileEmails(rows: unknown[], tenantId: string): string[] {
  const emails: string[] = [];
  for (const row of rows) {
    if (!record(row) || typeof row.email !== 'string') continue;
    const relation = row.roles;
    const role = Array.isArray(relation)
      ? (relation.length === 1 ? relation[0] : null)
      : relation;
    if (!record(role) || role.is_admin_role !== true) continue;
    // Older schemas have no roles.tenant_id. Existing columns use null for
    // global roles; all other values must match the selected request tenant.
    if (role.tenant_id !== undefined && role.tenant_id !== null && role.tenant_id !== tenantId) continue;
    emails.push(row.email);
  }
  return emails;
}

function denied(): DataRequestNotifyHttpResult {
  return {
    statusCode: 403,
    body: { ok: false, error: 'Für diese Anfrage besteht keine Berechtigung.' },
  };
}

function prepared(message: string): DataRequestNotifyHttpResult {
  return { statusCode: 200, body: { ok: true, status: 'prepared_only', message } };
}

/**
 * Server-only notification flow. Legacy clients may still send name, email and
 * type, but only persisted request fields are used. No recipient metadata is
 * returned to the caller. All I/O is injected for isolated security tests.
 */
export async function handleDataSubjectRequestAdminNotify(
  request: Request,
  dependencies: DataRequestNotifyDependencies,
): Promise<DataRequestNotifyHttpResult> {
  if (request.method !== 'POST') {
    return { statusCode: 405, body: { ok: false, error: 'Methode nicht erlaubt.' } };
  }

  let input: unknown;
  try {
    const text = await request.text();
    if (text.length > 16_384) {
      return { statusCode: 413, body: { ok: false, error: 'Anfrage ist zu groß.' } };
    }
    input = JSON.parse(text);
  } catch {
    return { statusCode: 400, body: { ok: false, error: 'Anfrage konnte nicht gelesen werden.' } };
  }
  if (!record(input) || typeof input.tenantId !== 'string' || typeof input.requestId !== 'string') {
    return { statusCode: 400, body: { ok: false, error: 'Mandant oder Anfrage-ID fehlt.' } };
  }
  const tenantId = input.tenantId.trim();
  const requestId = input.requestId.trim();
  if (!UUID.test(tenantId) || !UUID.test(requestId)) {
    return { statusCode: 400, body: { ok: false, error: 'Mandant oder Anfrage-ID ist ungültig.' } };
  }

  try {
    const caller = await dependencies.resolveCaller(request, tenantId);
    if (!caller || caller.tenantId !== tenantId || !caller.active || !caller.selfService ||
        !UUID.test(caller.authUserId) || !UUID.test(caller.profileId) ||
        (caller.profileId !== caller.authUserId && caller.profileAuthUserId !== caller.authUserId)) {
      return denied();
    }

    const stored = await dependencies.loadRequest(tenantId, requestId);
    if (!stored || stored.id !== requestId || stored.tenant_id !== tenantId ||
        (stored.profile_id !== caller.profileId && !caller.adminManage)) {
      return denied();
    }
    if (!REQUEST_TYPES.has(stored.request_type)) {
      return { statusCode: 500, body: { ok: false, error: 'Die gespeicherte Anfrage konnte nicht verarbeitet werden.' } };
    }

    if (!dependencies.isConfigured()) {
      return prepared('Die Anfrage ist gespeichert. Eine zusätzliche E-Mail-Benachrichtigung ist derzeit nicht verfügbar.');
    }
    const recipients = await dependencies.loadRecipients(tenantId);
    if (recipients.length === 0) {
      return prepared('Die Anfrage ist gespeichert. Eine zusätzliche E-Mail-Benachrichtigung ist derzeit nicht verfügbar.');
    }

    // This service-only RPC atomically claims the immutable request ID. Missing
    // migrations or an uncertain previous delivery fail closed: never fall back
    // to sending without a persistent claim.
    const claim = await dependencies.claimDelivery(requestId);
    if (!claim.claimed) {
      return prepared('Die Anfrage ist gespeichert. Die zusätzliche Benachrichtigung wurde bereits übernommen.');
    }
    if (!claim.claimToken || !UUID.test(claim.claimToken)) {
      throw new Error('Invalid notification claim');
    }

    const payload: AdminNotifyRequestPayload = {
      tenantId: stored.tenant_id,
      requestId: stored.id,
      requestType: stored.request_type,
      requesterName: stored.requester_name ?? 'Nicht angegeben',
      requesterEmail: stored.requester_email ?? 'Nicht angegeben',
      receivedAt: stored.received_at ?? stored.created_at,
    };
    let sent = false;
    try {
      sent = (await dependencies.send(payload, recipients)).ok;
    } catch {
      // A provider timeout can mean the message was accepted. Keep the claim
      // permanently; a browser retry must not cause another external delivery.
      sent = false;
    }
    try {
      await dependencies.finishDelivery(requestId, claim.claimToken, sent);
    } catch {
      // Recording delivery status must not cause another attempt or override an
      // acknowledged provider outcome. The durable claim still prevents replay.
    }

    if (!sent) {
      return {
        statusCode: 502,
        body: {
          ok: false,
          status: 'send_failed',
          message: 'Die Anfrage ist gespeichert. Der Versand der zusätzlichen Benachrichtigung konnte nicht bestätigt werden.',
          error: 'E-Mail-Versand konnte nicht bestätigt werden.',
        },
      };
    }
    return {
      statusCode: 200,
      body: { ok: true, status: 'sent', message: 'Die zusätzliche Admin-Benachrichtigung wurde versendet.' },
    };
  } catch {
    return {
      statusCode: 503,
      body: {
        ok: false,
        error: 'Die zusätzliche Benachrichtigung ist derzeit nicht verfügbar.',
      },
    };
  }
}
