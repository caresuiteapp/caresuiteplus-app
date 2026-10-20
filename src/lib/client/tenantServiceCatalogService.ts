import type { ServiceResult } from '@/types';
import type {
  TenantServiceProofTemplate,
  TenantServiceTaskCatalogItem,
  TenantServiceVisitType,
} from '@/types/clientCore';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { ensureTenantClientCoreSeeded } from './clientServiceTypeService';

function mapTask(row: Record<string, unknown>): TenantServiceTaskCatalogItem {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    serviceTypeId: row.service_type_id as string,
    taskKey: row.task_key as string,
    label: row.label as string,
    description: row.description as string | null,
    category: row.category as string | null,
    defaultDurationMinutes: row.default_duration_minutes as number | null,
    isBillable: row.is_billable as boolean,
    isActive: row.is_active as boolean,
    sortOrder: row.sort_order as number,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function mapVisitType(row: Record<string, unknown>): TenantServiceVisitType {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    serviceTypeId: row.service_type_id as string,
    visitTypeKey: row.visit_type_key as string,
    label: row.label as string,
    description: row.description as string | null,
    defaultDurationMinutes: row.default_duration_minutes as number | null,
    requiresProof: row.requires_proof as boolean,
    requiresSignature: row.requires_signature as boolean,
    isActive: row.is_active as boolean,
    sortOrder: row.sort_order as number,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function mapProofTemplate(row: Record<string, unknown>): TenantServiceProofTemplate {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    serviceTypeId: row.service_type_id as string,
    templateKey: row.template_key as string,
    label: row.label as string,
    documentTemplateKey: row.document_template_key as string | null,
    isDefault: row.is_default as boolean,
    isActive: row.is_active as boolean,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

export async function listTenantServiceTaskCatalog(
  tenantId: string,
  options?: { serviceTypeId?: string; activeOnly?: boolean },
): Promise<ServiceResult<TenantServiceTaskCatalogItem[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    await ensureTenantClientCoreSeeded(tenantId);

    let query = fromUnknownTable(client, 'tenant_service_task_catalog')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    if (options?.serviceTypeId) query = query.eq('service_type_id', options.serviceTypeId);
    if (options?.activeOnly !== false) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    return { ok: true, data: (data ?? []).map((row) => mapTask(row as Record<string, unknown>)) };
  });
}

export async function listTenantServiceVisitTypes(
  tenantId: string,
  options?: { serviceTypeId?: string; activeOnly?: boolean },
): Promise<ServiceResult<TenantServiceVisitType[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    await ensureTenantClientCoreSeeded(tenantId);

    let query = fromUnknownTable(client, 'tenant_service_visit_types')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    if (options?.serviceTypeId) query = query.eq('service_type_id', options.serviceTypeId);
    if (options?.activeOnly !== false) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    return { ok: true, data: (data ?? []).map((row) => mapVisitType(row as Record<string, unknown>)) };
  });
}

export async function listTenantServiceProofTemplates(
  tenantId: string,
  options?: { serviceTypeId?: string; activeOnly?: boolean },
): Promise<ServiceResult<TenantServiceProofTemplate[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    await ensureTenantClientCoreSeeded(tenantId);

    let query = fromUnknownTable(client, 'tenant_service_proof_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('label', { ascending: true });

    if (options?.serviceTypeId) query = query.eq('service_type_id', options.serviceTypeId);
    if (options?.activeOnly !== false) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    return { ok: true, data: (data ?? []).map((row) => mapProofTemplate(row as Record<string, unknown>)) };
  });
}
