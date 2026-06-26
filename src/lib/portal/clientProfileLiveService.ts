import type { ServiceResult } from '@/types';
import type { PortalClientCarePlanSummary, PortalClientProfile } from '@/types/portal/client';
import type { PortalAccessStatus } from '@/types/modules/client/clientPortal';
import { fetchClientPortalSettingsResolved } from '@/lib/client/clientPortalSettingsService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { runService } from '@/lib/services/serviceRunner';
import type { WorkflowStatus } from '@/types/workflow/status';
import { formatClientPortalDisplayName } from './clientPortalDisplayName';
import { fetchClientPortalLiveMetrics } from './clientPortalDashboardLive';
import { buildClientPortalProfileProjection } from './clientPortalProfileProjection';

const UPCOMING_ASSIGNMENT_STATUSES = ['geplant', 'bestaetigt', 'unterwegs', 'angekommen'] as const;

const CLIENT_PROFILE_SELECT = [
  'first_name',
  'last_name',
  'gender',
  'care_level',
  'city',
  'postal_code',
  'country',
  'street',
  'house_number',
  'floor',
  'apartment_number',
  'doorbell_name',
  'phone',
  'mobile',
  'email',
  'date_of_birth',
  'admission_date',
  'insurance_name',
  'insurance_number',
  'cost_bearer',
  'access_notes',
].join(', ');

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
      settingsResult,
      metrics,
      nextAssignmentResult,
      contactsResult,
      insuranceResult,
      careContextsResult,
      supportPrefsResult,
    ] = await Promise.all([
      fromUnknownTable(supabase, 'clients')
        .select(CLIENT_PROFILE_SELECT)
        .eq('tenant_id', tenantId)
        .eq('id', clientId)
        .maybeSingle(),
      fromUnknownTable(supabase, 'client_portal_access')
        .select('portal_username, portal_enabled, status, last_login_at')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .maybeSingle(),
      fetchClientPortalSettingsResolved(tenantId, clientId),
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
        .select(
          'id, first_name, last_name, full_name, name, relationship, relationship_label, phone, email, is_emergency, is_emergency_contact, is_portal_user, contact_type',
        )
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId),
      fromUnknownTable(supabase, 'client_insurance_profiles')
        .select(
          'care_level, care_level_valid_from, care_fund_name, health_insurance, insurance_number, is_primary',
        )
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .eq('is_primary', true)
        .maybeSingle(),
      fromUnknownTable(supabase, 'client_care_contexts')
        .select('context_key, is_primary')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId),
      fromUnknownTable(supabase, 'client_support_preferences')
        .select('communication')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
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

    if (!settingsResult.ok) {
      return settingsResult;
    }

    const row = clientResult.data as Record<string, unknown>;
    const displayName =
      formatClientPortalDisplayName({
        firstName: row.first_name as string | null,
        lastName: row.last_name as string | null,
        gender: row.gender as string | null,
      }) ?? 'Portal';

    if (insuranceResult.error && !isMissingTableError(insuranceResult.error)) {
      console.warn('[clientProfileLiveService] client_insurance_profiles:', insuranceResult.error.message);
    }
    if (careContextsResult.error && !isMissingTableError(careContextsResult.error)) {
      console.warn('[clientProfileLiveService] client_care_contexts:', careContextsResult.error.message);
    }
    if (supportPrefsResult.error && !isMissingTableError(supportPrefsResult.error)) {
      console.warn('[clientProfileLiveService] client_support_preferences:', supportPrefsResult.error.message);
    }
    if (contactsResult.error && !isMissingTableError(contactsResult.error)) {
      console.warn('[clientProfileLiveService] client_contacts:', contactsResult.error.message);
    }

    const profile = buildClientPortalProfileProjection({
      tenantId,
      clientId,
      settings: settingsResult.data,
      clientRow: row,
      contacts: (contactsResult.data ?? []) as Record<string, unknown>[],
      insuranceRow: (insuranceResult.data as Record<string, unknown> | null) ?? null,
      careContexts: (careContextsResult.data ?? []) as Record<string, unknown>[],
      supportPreferences: (supportPrefsResult.data as Record<string, unknown> | null) ?? null,
      metrics,
      nextAssignment: (nextAssignmentResult.data as Record<string, unknown> | null) ?? null,
      displayName,
    });

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
