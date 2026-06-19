import type { ServiceResult } from '@/types';
import type {
  CreatePortalRequestInput,
  PortalRequest,
  PortalRequestStatus,
  PortalRequestType,
} from '@/types/portal/assist';
import { logPortalActivity } from '@/lib/portal/assist/portalActivityService';
import { stubEmployeeNotificationForRequest } from '@/lib/portal/assist/portalAssistEvents';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';

const REQUEST_TYPE_LABELS: Record<PortalRequestType, string> = {
  termin_aendern: 'Terminänderung',
  zusatztermin: 'Zusatztermin',
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
  };
}

export function resolvePortalRequestTypeLabel(type: PortalRequestType): string {
  return REQUEST_TYPE_LABELS[type] ?? type;
}

/** List portal requests for a client, optionally filtered by status. */
export async function listPortalRequests(
  tenantId: string,
  clientId: string,
  options?: { status?: PortalRequestStatus[]; limit?: number },
): Promise<ServiceResult<PortalRequest[]>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    let query = fromUnknownTable(supabase, 'portal_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (options?.status?.length) {
      query = query.in('status', options.status);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) return { ok: true, data: [] };
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return {
      ok: true,
      data: ((data ?? []) as Record<string, unknown>[]).map(mapRequestRow),
    };
  });
}

/** Office: list all open portal requests for tenant. */
export async function listTenantPortalRequests(
  tenantId: string,
  options?: { status?: PortalRequestStatus[]; limit?: number },
): Promise<ServiceResult<PortalRequest[]>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    let query = fromUnknownTable(supabase, 'portal_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    const statuses = options?.status ?? ['offen', 'in_bearbeitung'];
    if (statuses.length) {
      query = query.in('status', statuses);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) return { ok: true, data: [] };
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return {
      ok: true,
      data: ((data ?? []) as Record<string, unknown>[]).map(mapRequestRow),
    };
  });
}

/** Create a portal request, log activity, and notify office stub. */
export async function createPortalRequest(
  input: CreatePortalRequestInput,
): Promise<ServiceResult<PortalRequest>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const title =
      input.title.trim() ||
      resolvePortalRequestTypeLabel(input.requestType);

    const { data, error } = await fromUnknownTable(supabase, 'portal_requests')
      .insert({
        tenant_id: input.tenantId,
        client_id: input.clientId,
        portal_user_id: input.portalUserId ?? null,
        module_key: input.moduleKey ?? 'assist',
        request_type: input.requestType,
        status: 'offen',
        title,
        description: input.description?.trim() || null,
        payload: input.payload ?? {},
      })
      .select('*')
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        return { ok: false, error: 'Portal-Anfragen sind noch nicht verfügbar.' };
      }
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    const request = mapRequestRow(data as Record<string, unknown>);

    await fromUnknownTable(supabase, 'portal_request_status_history').insert({
      tenant_id: input.tenantId,
      request_id: request.id,
      from_status: null,
      to_status: 'offen',
      changed_by: input.portalUserId ?? null,
      note: 'Anfrage erstellt',
    });

    await logPortalActivity({
      tenantId: input.tenantId,
      clientId: input.clientId,
      portalUserId: input.portalUserId,
      moduleKey: input.moduleKey ?? 'assist',
      activityType: 'request_created',
      title: `Anfrage: ${title}`,
      description: input.description ?? null,
      metadata: { requestId: request.id, requestType: input.requestType },
    });

    await stubEmployeeNotificationForRequest(request);

    return { ok: true, data: request };
  });
}
