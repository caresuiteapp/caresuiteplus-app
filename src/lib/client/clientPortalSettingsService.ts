import type { ServiceResult } from '@/types';
import type {
  ClientPortalAccessRequest,
  ClientPortalSettingsResolved,
  TenantClientPortalDefaults,
} from '@/types/clientCore';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { ensureTenantClientCoreSeeded } from './clientServiceTypeService';

function mapTenantDefaults(row: Record<string, unknown>): TenantClientPortalDefaults {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    portalEnabled: row.portal_enabled as boolean,
    showAppointments: row.show_appointments as boolean,
    showMessages: row.show_messages as boolean,
    showDocuments: row.show_documents as boolean,
    showProofs: row.show_proofs as boolean,
    showBudget: row.show_budget as boolean,
    showVisitTracking: row.show_visit_tracking as boolean,
    allowAccessRequests: row.allow_access_requests as boolean,
  };
}

function resolvePortalSettings(
  tenant: TenantClientPortalDefaults,
  clientRow: Record<string, unknown> | null,
): ClientPortalSettingsResolved {
  const inherit = clientRow?.inherit_tenant_defaults !== false;
  const pick = (clientKey: string, tenantValue: boolean): boolean => {
    if (!clientRow || inherit || clientRow[clientKey] == null) return tenantValue;
    return Boolean(clientRow[clientKey]);
  };

  return {
    portalEnabled: pick('portal_enabled', tenant.portalEnabled),
    showAppointments: pick('show_appointments', tenant.showAppointments),
    showMessages: pick('show_messages', tenant.showMessages),
    showDocuments: pick('show_documents', tenant.showDocuments),
    showProofs: pick('show_proofs', tenant.showProofs),
    showBudget: pick('show_budget', tenant.showBudget),
    showVisitTracking: false,
    inheritTenantDefaults: inherit,
    source: clientRow && !inherit ? 'client' : 'tenant',
  };
}

export async function fetchTenantClientPortalDefaults(
  tenantId: string,
): Promise<ServiceResult<TenantClientPortalDefaults>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    await ensureTenantClientCoreSeeded(tenantId);

    const { data, error } = await fromUnknownTable(client, 'tenant_client_portal_defaults')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: false, error: 'Portal-Defaults nicht gefunden.' };

    return { ok: true, data: mapTenantDefaults(data as Record<string, unknown>) };
  });
}

export async function fetchClientPortalSettingsResolved(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientPortalSettingsResolved>> {
  return runService(async () => {
    const tenantResult = await fetchTenantClientPortalDefaults(tenantId);
    if (!tenantResult.ok) return tenantResult;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'client_portal_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    return {
      ok: true,
      data: resolvePortalSettings(tenantResult.data, data as Record<string, unknown> | null),
    };
  });
}

export async function listClientPortalAccessRequests(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientPortalAccessRequest[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'client_portal_access_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    return {
      ok: true,
      data: (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        tenantId: row.tenant_id as string,
        clientId: row.client_id as string,
        requesterName: row.requester_name as string,
        requesterEmail: row.requester_email as string | null,
        requesterPhone: row.requester_phone as string | null,
        requestType: row.request_type as string,
        status: row.status as ClientPortalAccessRequest['status'],
        requestedFeatures: (row.requested_features as string[]) ?? [],
        reviewNote: row.review_note as string | null,
        reviewedAt: row.reviewed_at as string | null,
        createdAt: row.created_at as string,
      })),
    };
  });
}

export async function listVisiblePortalFeatures(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<string[]>> {
  return runService(async () => {
    const settingsResult = await fetchClientPortalSettingsResolved(tenantId, clientId);
    if (!settingsResult.ok) return settingsResult;

    const s = settingsResult.data;
    if (!s.portalEnabled) return { ok: true, data: [] };

    const features: string[] = [];
    if (s.showAppointments) features.push('appointments');
    if (s.showMessages) features.push('messages');
    if (s.showDocuments) features.push('documents');
    if (s.showProofs) features.push('proofs');
    if (s.showBudget) features.push('budget');
    // visit_tracking intentionally excluded — no GPS in client portal

    return { ok: true, data: features };
  });
}

export async function upsertClientPortalSettings(
  tenantId: string,
  clientId: string,
  patch: Partial<{
    portalEnabled: boolean;
    inheritTenantDefaults: boolean;
    showAppointments: boolean;
    showMessages: boolean;
    showDocuments: boolean;
    showProofs: boolean;
    showBudget: boolean;
  }>,
): Promise<ServiceResult<ClientPortalSettingsResolved>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const payload: Record<string, unknown> = {
      tenant_id: tenantId,
      client_id: clientId,
      show_visit_tracking: false,
    };
    if (patch.portalEnabled !== undefined) payload.portal_enabled = patch.portalEnabled;
    if (patch.inheritTenantDefaults !== undefined) payload.inherit_tenant_defaults = patch.inheritTenantDefaults;
    if (patch.showAppointments !== undefined) payload.show_appointments = patch.showAppointments;
    if (patch.showMessages !== undefined) payload.show_messages = patch.showMessages;
    if (patch.showDocuments !== undefined) payload.show_documents = patch.showDocuments;
    if (patch.showProofs !== undefined) payload.show_proofs = patch.showProofs;
    if (patch.showBudget !== undefined) payload.show_budget = patch.showBudget;

    const { error } = await fromUnknownTable(client, 'client_portal_settings')
      .upsert(payload, { onConflict: 'tenant_id,client_id' });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return fetchClientPortalSettingsResolved(tenantId, clientId);
  });
}
