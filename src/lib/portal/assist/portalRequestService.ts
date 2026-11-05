import type { ServiceResult } from '@/types';
import type {
  CreatePortalRequestInput,
  PortalRequest,
  PortalRequestStatus,
  PortalRequestType,
} from '@/types/portal/assist';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { resolveAuthenticatedProfileId } from '@/lib/auth/resolveAuthenticatedProfile';

const REQUEST_TYPE_LABELS: Record<PortalRequestType, string> = {
  termin_aendern: 'Einsatzänderung',
  zusatztermin: 'Zusatzeinsatz',
  rueckruf: 'Rückruf',
  nachricht: 'Nachricht',
  upload: 'Dokument-Upload',
  nachweise: 'Nachweise',
  stammdaten: 'Stammdatenänderung',
  beschwerde: 'Beschwerde',
  lob: 'Lob',
  sonstiges: 'Sonstige Anfrage',
};

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapRequestRow(row: Record<string, unknown>): PortalRequest {
  const client = row.client as { full_name?: string; first_name?: string; last_name?: string } | null;
  return {
    id: String(row.id ?? ''),
    tenantId: String(row.tenant_id ?? ''),
    clientId: String(row.client_id ?? ''),
    portalUserId: row.portal_user_id ? String(row.portal_user_id) : null,
    moduleKey: String(row.module_key ?? 'assist'),
    requestType: String(row.request_type ?? 'sonstiges') as PortalRequestType,
    status: String(row.status ?? 'offen') as PortalRequestStatus,
    title: String(row.title ?? ''),
    description: row.description ? String(row.description) : null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
    clientName: client ? client.full_name || `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || null : null,
    officeThreadId: row.office_thread_id ? String(row.office_thread_id) : null,
    officeMessageId: row.office_message_id ? String(row.office_message_id) : null,
    officeDeliveredAt: row.office_delivered_at ? String(row.office_delivered_at) : null,
  };
}

export function resolvePortalRequestTypeLabel(type: PortalRequestType): string {
  return REQUEST_TYPE_LABELS[type] ?? type;
}

/** Fetch every requested row; a page/server limit must not become a false empty inbox. */
async function listRequestRows(
  tenantId: string,
  clientId: string | undefined,
  options?: { status?: PortalRequestStatus[]; limit?: number },
): Promise<ServiceResult<PortalRequest[]>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const rows: PortalRequest[] = [];
    for (let offset = 0; ; ) {
      const size = options?.limit ? Math.min(100, options.limit - rows.length) : 100;
      if (size <= 0) break;
      let query = fromUnknownTable(supabase, 'portal_requests')
        .select('*, client:clients(full_name, first_name, last_name)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
      // Apply client scope before pagination, rather than filtering a tenant's
      // first twenty rows afterwards in the client record panel.
      if (clientId) query = query.eq('client_id', clientId);
      if (options?.status?.length) query = query.in('status', options.status);
      const { data, error } = await query.range(offset, offset + size - 1);
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
      const page = (data ?? []) as Record<string, unknown>[];
      rows.push(...page.map(mapRequestRow));
      if (page.length < size || (options?.limit && rows.length >= options.limit)) break;
      offset += page.length;
    }
    return { ok: true, data: rows };
  });
}

export function listPortalRequests(
  tenantId: string,
  clientId: string,
  options?: { status?: PortalRequestStatus[]; limit?: number },
): Promise<ServiceResult<PortalRequest[]>> {
  return listRequestRows(tenantId, clientId, options);
}

/** Office: all open requests, optionally scoped to one client in the database. */
export function listTenantPortalRequests(
  tenantId: string,
  options?: { clientId?: string; status?: PortalRequestStatus[]; limit?: number },
): Promise<ServiceResult<PortalRequest[]>> {
  return listRequestRows(tenantId, options?.clientId, {
    ...options, status: options?.status ?? ['offen', 'in_bearbeitung'],
  });
}

// Retain a submission ID after an uncertain network result. Retrying the same
// draft then reads its original server receipt instead of creating a duplicate.
const retryIds = new Map<string, Promise<string>>();
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]),
  );
  return value;
}
async function newSubmissionId(): Promise<string> {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return (await import('expo-crypto')).randomUUID();
}

/** The server commits request, Office message and receipt atomically. */
export async function createPortalRequest(
  input: CreatePortalRequestInput,
): Promise<ServiceResult<PortalRequest>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const title =
      input.title.trim() ||
      resolvePortalRequestTypeLabel(input.requestType);

    const author = await resolveAuthenticatedProfileId(input.tenantId);
    if (!author.ok) return author;
    const authorProfileId = author.data;

    const args = {
      p_tenant_id: input.tenantId, p_client_id: input.clientId,
      p_module_key: input.moduleKey?.trim() || 'assist', p_request_type: input.requestType,
      p_title: title, p_description: input.description?.trim() || null, p_payload: input.payload ?? {},
    };
    const key = JSON.stringify(canonical({ ...args, profile: authorProfileId, requestId: input.requestId }));
    let submission = retryIds.get(key);
    if (!submission) {
      submission = input.requestId ? Promise.resolve(input.requestId) : newSubmissionId();
      retryIds.set(key, submission);
    }
    const requestId = await submission;
    const rpc = supabase as unknown as { rpc: (name: string, values: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }> };
    const { data, error } = await rpc.rpc('portal_submit_request', { ...args, p_request_id: requestId });

    if (error) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    if (!data || typeof data !== 'object') return { ok: false, error: 'Der Eingang Ihrer Anfrage konnte nicht bestätigt werden. Bitte erneut versuchen.' };
    const request = mapRequestRow(data as Record<string, unknown>);
    if (request.id !== requestId || request.tenantId !== input.tenantId || request.clientId !== input.clientId ||
        request.portalUserId !== authorProfileId || !request.officeThreadId || !request.officeMessageId || !request.officeDeliveredAt) {
      return { ok: false, error: 'Der Eingang Ihrer Anfrage konnte nicht bestätigt werden. Bitte erneut versuchen.' };
    }
    retryIds.delete(key);
    return { ok: true, data: request };
  });
}
