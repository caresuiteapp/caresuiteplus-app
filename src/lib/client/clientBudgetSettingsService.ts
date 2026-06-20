import type { ServiceResult } from '@/types';
import type {
  ClientBudgetMovement,
  ClientBudgetSetting,
  TenantBudgetDefault,
  TenantBudgetType,
  TenantBudgetYear,
} from '@/types/clientCore';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { ensureTenantClientCoreSeeded } from './clientServiceTypeService';

function remainingCents(setting: ClientBudgetSetting): number {
  return setting.allocatedCents - setting.usedCents - setting.reservedCents;
}

export async function listTenantBudgetYears(
  tenantId: string,
): Promise<ServiceResult<TenantBudgetYear[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    await ensureTenantClientCoreSeeded(tenantId);

    const { data, error } = await fromUnknownTable(client, 'tenant_budget_years')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('budget_year', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    return {
      ok: true,
      data: (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        tenantId: row.tenant_id as string,
        budgetYear: row.budget_year as number,
        label: row.label as string | null,
        isActive: row.is_active as boolean,
      })),
    };
  });
}

export async function listTenantBudgetDefaults(
  tenantId: string,
  budgetYear?: number,
): Promise<ServiceResult<TenantBudgetDefault[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    await ensureTenantClientCoreSeeded(tenantId);

    let query = fromUnknownTable(client, 'tenant_budget_defaults')
      .select(`
        *,
        tenant_budget_years ( budget_year ),
        tenant_budget_types ( budget_type_key, name )
      `)
      .eq('tenant_id', tenantId);

    const { data, error } = await query;
    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const rows = (data ?? [])
      .map((row: Record<string, unknown>) => {
        const year = row.tenant_budget_years as { budget_year: number } | null;
        if (budgetYear && year?.budget_year !== budgetYear) return null;
        return {
          id: row.id as string,
          tenantId: row.tenant_id as string,
          budgetYearId: row.budget_year_id as string,
          budgetTypeId: row.budget_type_id as string,
          amountCents: Number(row.amount_cents),
          conversionRatePct: row.conversion_rate_pct != null ? Number(row.conversion_rate_pct) : null,
          monthlyAmountCents: row.monthly_amount_cents != null ? Number(row.monthly_amount_cents) : null,
          yearlyAmountCents: row.yearly_amount_cents != null ? Number(row.yearly_amount_cents) : null,
          notes: row.notes as string | null,
        };
      })
      .filter(Boolean) as TenantBudgetDefault[];

    return { ok: true, data: rows };
  });
}

export async function listClientBudgetSettings(
  tenantId: string,
  clientId: string,
  budgetYear?: number,
): Promise<ServiceResult<ClientBudgetSetting[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'client_budget_settings')
      .select(`
        *,
        tenant_budget_years ( budget_year ),
        tenant_budget_types ( budget_type_key, name )
      `)
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const settings = (data ?? [])
      .map((row: Record<string, unknown>) => {
        const year = row.tenant_budget_years as { budget_year: number } | null;
        const type = row.tenant_budget_types as { budget_type_key: string; name: string } | null;
        if (budgetYear && year?.budget_year !== budgetYear) return null;

        const setting: ClientBudgetSetting = {
          id: row.id as string,
          tenantId: row.tenant_id as string,
          clientId: row.client_id as string,
          budgetYearId: row.budget_year_id as string,
          budgetTypeId: row.budget_type_id as string,
          budgetYear: year?.budget_year,
          budgetTypeKey: type?.budget_type_key,
          budgetTypeName: type?.name,
          allocatedCents: Number(row.allocated_cents),
          usedCents: Number(row.used_cents),
          reservedCents: Number(row.reserved_cents),
          conversionRatePct: row.conversion_rate_pct != null ? Number(row.conversion_rate_pct) : null,
          monthlyLimitCents: row.monthly_limit_cents != null ? Number(row.monthly_limit_cents) : null,
          yearlyLimitCents: row.yearly_limit_cents != null ? Number(row.yearly_limit_cents) : null,
          notes: row.notes as string | null,
        };
        setting.remainingCents = remainingCents(setting);
        return setting;
      })
      .filter(Boolean) as ClientBudgetSetting[];

    return { ok: true, data: settings };
  });
}

export async function initializeClientBudgetFromDefaults(
  tenantId: string,
  clientId: string,
  budgetYear = 2026,
): Promise<ServiceResult<ClientBudgetSetting[]>> {
  return runService(async () => {
    const defaultsResult = await listTenantBudgetDefaults(tenantId, budgetYear);
    if (!defaultsResult.ok) return defaultsResult;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    for (const def of defaultsResult.data) {
      const { error } = await fromUnknownTable(client, 'client_budget_settings')
        .upsert(
          {
            tenant_id: tenantId,
            client_id: clientId,
            budget_year_id: def.budgetYearId,
            budget_type_id: def.budgetTypeId,
            allocated_cents: def.yearlyAmountCents ?? def.amountCents,
            conversion_rate_pct: def.conversionRatePct,
            monthly_limit_cents: def.monthlyAmountCents,
            yearly_limit_cents: def.yearlyAmountCents,
            notes: def.notes,
          },
          { onConflict: 'tenant_id,client_id,budget_year_id,budget_type_id', ignoreDuplicates: true },
        );
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
    }

    return listClientBudgetSettings(tenantId, clientId, budgetYear);
  });
}

export async function listClientBudgetMovements(
  tenantId: string,
  clientId: string,
  budgetSettingId: string,
): Promise<ServiceResult<ClientBudgetMovement[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'client_budget_movements')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('budget_setting_id', budgetSettingId)
      .order('created_at', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    return {
      ok: true,
      data: (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        tenantId: row.tenant_id as string,
        clientId: row.client_id as string,
        budgetSettingId: row.budget_setting_id as string,
        movementType: row.movement_type as ClientBudgetMovement['movementType'],
        amountCents: Number(row.amount_cents),
        referenceType: row.reference_type as string | null,
        referenceId: row.reference_id as string | null,
        note: row.note as string | null,
        createdAt: row.created_at as string,
      })),
    };
  });
}

export async function listTenantBudgetTypes(
  tenantId: string,
): Promise<ServiceResult<TenantBudgetType[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    await ensureTenantClientCoreSeeded(tenantId);

    const { data, error } = await fromUnknownTable(client, 'tenant_budget_types')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    return {
      ok: true,
      data: (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        tenantId: row.tenant_id as string,
        budgetTypeKey: row.budget_type_key as string,
        name: row.name as string,
        description: row.description as string | null,
        period: row.period as TenantBudgetType['period'],
        currency: row.currency as string,
        isActive: row.is_active as boolean,
        sortOrder: row.sort_order as number,
      })),
    };
  });
}
