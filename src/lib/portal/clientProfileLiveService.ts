import type { ServiceResult } from '@/types';
import type { PortalClientCarePlanSummary, PortalClientProfile } from '@/types/portal/client';
import type { PortalAccessStatus } from '@/types/modules/client/clientPortal';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { runService } from '@/lib/services/serviceRunner';
import type { WorkflowStatus } from '@/types/workflow/status';
import { formatClientPortalDisplayName } from './clientPortalDisplayName';
import { fetchClientPortalLiveMetrics } from './clientPortalDashboardLive';

const UPCOMING_ASSIGNMENT_STATUSES = ['geplant', 'bestaetigt', 'unterwegs', 'angekommen'] as const;

export type ClientPortalAccessSummary = {
  portalUsername: string | null;
  portalEnabled: boolean;
  status: PortalAccessStatus | null;
  lastLoginAt: string | null;
};

export type LiveClientPortalProfileBundle = {
  profile: PortalClientProfile;
  portalAccess: ClientPortalAccessSummary | null;
};

function mapAccessStatus(value: unknown): PortalAccessStatus | null {
  const key = String(value ?? '').trim();
  if (
    key === 'aktiv' ||
    key === 'eingeladen' ||
    key === 'gesperrt' ||
    key === 'deaktiviert' ||
    key === 'nicht_eingerichtet'
  ) {
    return key;
  }
  return null;
}

function mapCarePlanStatus(value: unknown): WorkflowStatus {
  const key = String(value ?? 'active').trim().toLowerCase();
  if (key === 'active' || key === 'aktiv') return 'aktiv';
  if (key === 'draft' || key === 'entwurf') return 'entwurf';
  if (key === 'paused' || key === 'in_bearbeitung') return 'in_bearbeitung';
  if (key === 'archived' || key === 'archiviert') return 'archiviert';
  return 'aktiv';
}

async function fetchLiveCarePlanSummaries(
  tenantId: string,
  clientId: string,
): Promise<PortalClientCarePlanSummary[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await fromUnknownTable(supabase, 'care_plans')
    .select('id, title, valid_until, status')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('valid_until', { ascending: false });

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[clientProfileLiveService] care_plans:', error.message);
    }
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id ?? ''),
    title: String(row.title ?? 'Pflegeplan'),
    validUntil: row.valid_until ? String(row.valid_until) : null,
    status: mapCarePlanStatus(row.status),
    summary: 'Freigegebener Pflegeplan',
    taskCount: 0,
  }));
}

/** Live client profile for portal actors — RLS scopes rows to the signed-in portal user. */
export async function fetchLiveClientPortalProfile(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<LiveClientPortalProfileBundle>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: 'Supabase ist nicht verfügbar.' };
    }
    if (!tenantId.trim() || !clientId.trim()) {
      return { ok: false, error: 'Kein Klient:innenprofil mit diesem Portal verknüpft.' };
    }

    const [
      clientResult,
      accessResult,
      metrics,
      nextAssignmentResult,
      emergencyContactResult,
    ] = await Promise.all([
      fromUnknownTable(supabase, 'clients')
        .select('first_name, last_name, gender, care_level, city, postal_code, phone, mobile, email')
        .eq('tenant_id', tenantId)
        .eq('id', clientId)
        .maybeSingle(),
      fromUnknownTable(supabase, 'client_portal_access')
        .select('portal_username, portal_enabled, status, last_login_at')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .maybeSingle(),
      fetchClientPortalLiveMetrics(tenantId, clientId),
      fromUnknownTable(supabase, 'assignments')
        .select('service_type, planned_start_at')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .gte('planned_start_at', new Date().toISOString())
        .in('status', [...UPCOMING_ASSIGNMENT_STATUSES])
        .order('planned_start_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      fromUnknownTable(supabase, 'client_contacts')
        .select('name, phone, is_emergency')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .eq('is_emergency', true)
        .limit(1)
        .maybeSingle(),
    ]);

    if (clientResult.error) {
      if (!isMissingTableError(clientResult.error)) {
        console.warn('[clientProfileLiveService] clients:', clientResult.error.message);
      }
      return { ok: false, error: 'Klient:innenprofil nicht gefunden.' };
    }
    if (!clientResult.data) {
      return { ok: false, error: 'Klient:innenprofil nicht gefunden.' };
    }

    const row = clientResult.data as Record<string, unknown>;
    const displayName =
      formatClientPortalDisplayName({
        firstName: row.first_name as string | null,
        lastName: row.last_name as string | null,
        gender: row.gender as string | null,
      }) ?? 'Portal';

    const phone =
      (typeof row.mobile === 'string' && row.mobile.trim() ? row.mobile.trim() : null) ??
      (typeof row.phone === 'string' && row.phone.trim() ? row.phone.trim() : null);

    let emergencyContact: string | null = null;
    if (!emergencyContactResult.error && emergencyContactResult.data) {
      const contact = emergencyContactResult.data as { name?: string | null; phone?: string | null };
      const name = contact.name?.trim() ?? '';
      const contactPhone = contact.phone?.trim() ?? '';
      emergencyContact =
        name && contactPhone ? `${name} (${contactPhone})` : name || contactPhone || null;
    }

    const assignment = nextAssignmentResult.data as Record<string, unknown> | null;
    const nextAppointmentTitle = assignment
      ? String(assignment.service_type ?? 'Termin').trim() || 'Termin'
      : null;
    const nextAppointmentAt = assignment?.planned_start_at
      ? String(assignment.planned_start_at)
      : null;

    const profile: PortalClientProfile = {
      clientId,
      displayName,
      careLevel: row.care_level ? formatCareLevel(String(row.care_level)) || null : null,
      city: row.city ? String(row.city) : null,
      zip: row.postal_code ? String(row.postal_code) : null,
      primaryContactPhone: phone,
      emergencyContact,
      nextAppointmentTitle,
      nextAppointmentAt,
      openInvoices: 0,
      sharedDocuments: metrics.documents,
    };

    let portalAccess: ClientPortalAccessSummary | null = null;
    if (!accessResult.error && accessResult.data) {
      const access = accessResult.data as Record<string, unknown>;
      portalAccess = {
        portalUsername: access.portal_username ? String(access.portal_username) : null,
        portalEnabled: access.portal_enabled === true,
        status: mapAccessStatus(access.status),
        lastLoginAt: access.last_login_at ? String(access.last_login_at) : null,
      };
    } else if (accessResult.error && !isMissingTableError(accessResult.error)) {
      console.warn('[clientProfileLiveService] client_portal_access:', accessResult.error.message);
    }

    return { ok: true, data: { profile, portalAccess } };
  });
}

export async function fetchLiveClientCarePlanSummaries(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<PortalClientCarePlanSummary[]>> {
  return runService(async () => {
    if (!tenantId.trim() || !clientId.trim()) {
      return { ok: true, data: [] };
    }
    const data = await fetchLiveCarePlanSummaries(tenantId, clientId);
    return { ok: true, data };
  });
}
