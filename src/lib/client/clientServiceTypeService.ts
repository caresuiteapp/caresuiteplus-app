import type { ServiceResult } from '@/types';
import type {
  ClientServiceProfile,
  ClientServiceTypeKey,
  TenantClientServiceType,
  TenantServiceIntakeSection,
} from '@/types/clientCore';
import { CARE_CONTEXT_TO_SERVICE_TYPE, SERVICE_TYPE_TO_CARE_CONTEXT } from '@/types/clientCore';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';

type ServiceTypeRow = {
  id: string;
  tenant_id: string;
  service_type_key: string;
  care_context_key: string;
  name: string;
  description: string | null;
  module_keys: string[] | null;
  color_key: string | null;
  icon_key: string | null;
  is_active: boolean;
  is_system_template: boolean;
  sort_order: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = ServiceTypeRow & {
  profile_id?: string;
  client_id?: string;
  is_primary?: boolean;
  status?: string;
  started_on?: string | null;
  ended_on?: string | null;
  notes?: string | null;
};

function mapServiceType(row: ServiceTypeRow): TenantClientServiceType {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    serviceTypeKey: row.service_type_key as ClientServiceTypeKey,
    careContextKey: row.care_context_key,
    name: row.name,
    description: row.description,
    moduleKeys: row.module_keys ?? [],
    colorKey: row.color_key,
    iconKey: row.icon_key,
    isActive: row.is_active,
    isSystemTemplate: row.is_system_template,
    sortOrder: row.sort_order,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProfile(row: ProfileRow, type?: TenantClientServiceType): ClientServiceProfile {
  return {
    id: row.profile_id ?? row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id ?? '',
    serviceTypeId: type?.id ?? row.id,
    serviceTypeKey: type?.serviceTypeKey ?? (row.service_type_key as ClientServiceTypeKey),
    serviceTypeName: type?.name ?? row.name,
    isPrimary: row.is_primary ?? false,
    status: (row.status ?? 'active') as ClientServiceProfile['status'],
    startedOn: row.started_on ?? null,
    endedOn: row.ended_on ?? null,
    notes: row.notes ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureTenantClientCoreSeeded(tenantId: string): Promise<ServiceResult<void>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { error } = await client.rpc('seed_tenant_client_core_templates', { p_tenant_id: tenantId });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: undefined };
  });
}

export async function listTenantClientServiceTypes(
  tenantId: string,
): Promise<ServiceResult<TenantClientServiceType[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    await ensureTenantClientCoreSeeded(tenantId);

    const { data, error } = await fromUnknownTable(client, 'tenant_client_service_types')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data as ServiceTypeRow[]).map(mapServiceType) };
  });
}

export async function listClientServiceProfiles(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientServiceProfile[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'client_service_profiles')
      .select(`
        id, tenant_id, client_id, service_type_id, is_primary, status,
        started_on, ended_on, notes, metadata, created_at, updated_at,
        tenant_client_service_types (
          id, tenant_id, service_type_key, care_context_key, name,
          description, module_keys, color_key, icon_key, is_active,
          is_system_template, sort_order, metadata, created_at, updated_at
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const profiles = (data ?? []).map((row: Record<string, unknown>) => {
      const typeRow = row.tenant_client_service_types as ServiceTypeRow | null;
      const type = typeRow ? mapServiceType(typeRow) : undefined;
      return mapProfile(
        {
          ...(typeRow ?? {}),
          profile_id: row.id as string,
          client_id: row.client_id as string,
          is_primary: row.is_primary as boolean,
          status: row.status as string,
          started_on: row.started_on as string | null,
          ended_on: row.ended_on as string | null,
          notes: row.notes as string | null,
          metadata: row.metadata as Record<string, unknown>,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
        } as ProfileRow,
        type,
      );
    });

    return { ok: true, data: profiles };
  });
}

export async function syncClientServiceProfiles(
  tenantId: string,
  clientId: string,
  serviceTypeKeys: ClientServiceTypeKey[],
  primaryKey?: ClientServiceTypeKey,
): Promise<ServiceResult<ClientServiceProfile[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const typesResult = await listTenantClientServiceTypes(tenantId);
    if (!typesResult.ok) return typesResult;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const typeByKey = new Map(typesResult.data.map((t) => [t.serviceTypeKey, t]));
    const selectedIds = serviceTypeKeys
      .map((key) => typeByKey.get(key)?.id)
      .filter(Boolean) as string[];

    const existing = await listClientServiceProfiles(tenantId, clientId);
    if (!existing.ok) return existing;

    const existingIds = new Set(existing.data.map((p) => p.serviceTypeId));
    const toAdd = selectedIds.filter((id) => !existingIds.has(id));
    const toEnd = existing.data.filter(
      (p) => !selectedIds.includes(p.serviceTypeId) && p.status === 'active',
    );

    for (const profile of toEnd) {
      const endResult = await endClientServiceProfile(tenantId, clientId, profile.id);
      if (!endResult.ok) return endResult;
    }

    for (const typeId of toAdd) {
      const type = typesResult.data.find((t) => t.id === typeId);
      const { error } = await fromUnknownTable(client, 'client_service_profiles').insert({
        tenant_id: tenantId,
        client_id: clientId,
        service_type_id: typeId,
        is_primary: primaryKey ? type?.serviceTypeKey === primaryKey : false,
        status: 'active',
      });
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
    }

    if (primaryKey && typeByKey.has(primaryKey)) {
      const primaryId = typeByKey.get(primaryKey)!.id;
      await fromUnknownTable(client, 'client_service_profiles')
        .update({ is_primary: false })
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId);
      await fromUnknownTable(client, 'client_service_profiles')
        .update({ is_primary: true })
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .eq('service_type_id', primaryId);
    }

    return listClientServiceProfiles(tenantId, clientId);
  });
}

export function serviceTypeKeysToCareContexts(keys: ClientServiceTypeKey[]): ClientCareContext[] {
  return keys
    .map((key) => SERVICE_TYPE_TO_CARE_CONTEXT[key])
    .filter(Boolean) as ClientCareContext[];
}

export function careContextsToServiceTypeKeys(contexts: ClientCareContext[]): ClientServiceTypeKey[] {
  return contexts
    .map((ctx) => CARE_CONTEXT_TO_SERVICE_TYPE[ctx])
    .filter(Boolean) as ClientServiceTypeKey[];
}

export async function endClientServiceProfile(
  tenantId: string,
  clientId: string,
  profileId: string,
  endedOn?: string,
): Promise<ServiceResult<ClientServiceProfile>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const endDate = endedOn ?? new Date().toISOString().slice(0, 10);
    const { error } = await fromUnknownTable(client, 'client_service_profiles')
      .update({
        status: 'ended',
        ended_on: endDate,
        is_primary: false,
      })
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('id', profileId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const profiles = await listClientServiceProfiles(tenantId, clientId);
    if (!profiles.ok) return profiles;
    const profile = profiles.data.find((p) => p.id === profileId);
    if (!profile) return { ok: false, error: 'Leistungsbereich nicht gefunden.' };
    return { ok: true, data: profile };
  });
}

export async function addClientServiceProfile(
  tenantId: string,
  clientId: string,
  serviceTypeKey: ClientServiceTypeKey,
  options?: { isPrimary?: boolean; notes?: string | null; startedOn?: string | null },
): Promise<ServiceResult<ClientServiceProfile[]>> {
  return runService(async () => {
    const typesResult = await listTenantClientServiceTypes(tenantId);
    if (!typesResult.ok) return typesResult;

    const type = typesResult.data.find((t) => t.serviceTypeKey === serviceTypeKey);
    if (!type) return { ok: false, error: 'Leistungsart nicht gefunden.' };

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const existing = await listClientServiceProfiles(tenantId, clientId);
    if (!existing.ok) return existing;

    const active = existing.data.find(
      (p) => p.serviceTypeId === type.id && p.status === 'active',
    );
    if (active) return { ok: true, data: existing.data };

    const { error } = await fromUnknownTable(client, 'client_service_profiles').insert({
      tenant_id: tenantId,
      client_id: clientId,
      service_type_id: type.id,
      is_primary: options?.isPrimary ?? false,
      status: 'active',
      started_on: options?.startedOn ?? new Date().toISOString().slice(0, 10),
      notes: options?.notes ?? null,
    });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    if (options?.isPrimary) {
      await setPrimaryClientServiceProfile(tenantId, clientId, serviceTypeKey);
    }

    return listClientServiceProfiles(tenantId, clientId);
  });
}

export async function setPrimaryClientServiceProfile(
  tenantId: string,
  clientId: string,
  serviceTypeKey: ClientServiceTypeKey,
): Promise<ServiceResult<ClientServiceProfile[]>> {
  return runService(async () => {
    const typesResult = await listTenantClientServiceTypes(tenantId);
    if (!typesResult.ok) return typesResult;

    const type = typesResult.data.find((t) => t.serviceTypeKey === serviceTypeKey);
    if (!type) return { ok: false, error: 'Leistungsart nicht gefunden.' };

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    await fromUnknownTable(client, 'client_service_profiles')
      .update({ is_primary: false })
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('status', 'active');

    const { error } = await fromUnknownTable(client, 'client_service_profiles')
      .update({ is_primary: true })
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('service_type_id', type.id)
      .eq('status', 'active');

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return listClientServiceProfiles(tenantId, clientId);
  });
}

export async function updateClientServiceProfileNotes(
  tenantId: string,
  clientId: string,
  profileId: string,
  notes: string | null,
): Promise<ServiceResult<ClientServiceProfile>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { error } = await fromUnknownTable(client, 'client_service_profiles')
      .update({ notes })
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('id', profileId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const profiles = await listClientServiceProfiles(tenantId, clientId);
    if (!profiles.ok) return profiles;
    const profile = profiles.data.find((p) => p.id === profileId);
    if (!profile) return { ok: false, error: 'Leistungsbereich nicht gefunden.' };
    return { ok: true, data: profile };
  });
}

export async function updateTenantClientServiceType(
  tenantId: string,
  typeId: string,
  patch: Partial<{ name: string; description: string | null; isActive: boolean; sortOrder: number }>,
): Promise<ServiceResult<TenantClientServiceType>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.description !== undefined) payload.description = patch.description;
    if (patch.isActive !== undefined) payload.is_active = patch.isActive;
    if (patch.sortOrder !== undefined) payload.sort_order = patch.sortOrder;

    const { error } = await fromUnknownTable(client, 'tenant_client_service_types')
      .update(payload)
      .eq('tenant_id', tenantId)
      .eq('id', typeId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const list = await listTenantClientServiceTypes(tenantId);
    if (!list.ok) return list;
    const updated = list.data.find((t) => t.id === typeId);
    if (!updated) return { ok: false, error: 'Leistungsart nicht gefunden.' };
    return { ok: true, data: updated };
  });
}

/** Alias for UI/intake — loads DB intake sections for service type keys. */
export async function getServiceIntakeSections(
  tenantId: string,
  serviceTypeKeys: ClientServiceTypeKey[],
): Promise<ServiceResult<TenantServiceIntakeSection[]>> {
  return listIntakeSectionsForServiceTypes(tenantId, serviceTypeKeys);
}

export async function listIntakeSectionsForServiceTypes(
  tenantId: string,
  serviceTypeKeys: ClientServiceTypeKey[],
): Promise<ServiceResult<TenantServiceIntakeSection[]>> {
  return runService(async () => {
    const typesResult = await listTenantClientServiceTypes(tenantId);
    if (!typesResult.ok) return typesResult;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const typeIds = typesResult.data
      .filter((t) => serviceTypeKeys.includes(t.serviceTypeKey))
      .map((t) => t.id);

    if (typeIds.length === 0) return { ok: true, data: [] };

    const { data, error } = await fromUnknownTable(client, 'tenant_service_intake_sections')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('service_type_id', typeIds)
      .eq('is_visible', true)
      .order('sort_order', { ascending: true });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const sections = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      serviceTypeId: row.service_type_id as string,
      sectionKey: row.section_key as string,
      isRequired: row.is_required as boolean,
      isVisible: row.is_visible as boolean,
      sortOrder: row.sort_order as number,
    }));

    return { ok: true, data: sections };
  });
}
