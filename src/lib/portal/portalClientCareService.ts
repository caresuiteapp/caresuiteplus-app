import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  EMPTY_PORTAL_CARE_PROFILE,
  type PortalClientCareProfile,
} from '@/lib/portal/engine/portalFeatureAccess';
import type { PortalBudgetType } from '@/types/portal/assist';

const PORTAL_BUDGET_TYPES = new Set<PortalBudgetType>(['paragraph_45b', 'paragraph_45a']);

function mapBudgetType(value: unknown): PortalBudgetType | null {
  const key = String(value ?? '');
  return PORTAL_BUDGET_TYPES.has(key as PortalBudgetType) ? (key as PortalBudgetType) : null;
}

async function fetchCareContexts(
  tenantId: string,
  clientId: string,
): Promise<ClientCareContext[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await fromUnknownTable(supabase, 'client_care_contexts')
    .select('context_key')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId);

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[portalClientCareService] client_care_contexts:', error.message);
    }
    return [];
  }

  return (data ?? [])
    .map((row) => String((row as { context_key?: string }).context_key ?? '') as ClientCareContext)
    .filter(Boolean);
}

async function fetchConfiguredBudgetTypes(
  tenantId: string,
  clientId: string,
): Promise<PortalBudgetType[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await fromUnknownTable(supabase, 'client_budgets')
    .select('budget_type')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId);

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[portalClientCareService] client_budgets:', error.message);
    }
    return [];
  }

  const types = new Set<PortalBudgetType>();
  for (const row of data ?? []) {
    const mapped = mapBudgetType((row as { budget_type?: unknown }).budget_type);
    if (mapped) types.add(mapped);
  }
  return [...types];
}

async function fetchHasBudgetSnapshot(tenantId: string, clientId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { count, error } = await fromUnknownTable(supabase, 'portal_budget_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId);

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[portalClientCareService] portal_budget_snapshots:', error.message);
    }
    return false;
  }

  return (count ?? 0) > 0;
}

/** Loads care contexts, configured budgets, and snapshot presence for portal gating. */
export async function fetchPortalClientCareProfile(
  tenantId: string,
  clientId: string,
): Promise<PortalClientCareProfile> {
  if (!tenantId.trim() || !clientId.trim()) return EMPTY_PORTAL_CARE_PROFILE;

  const [careContexts, configuredBudgetTypes, hasBudgetSnapshot] = await Promise.all([
    fetchCareContexts(tenantId, clientId),
    fetchConfiguredBudgetTypes(tenantId, clientId),
    fetchHasBudgetSnapshot(tenantId, clientId),
  ]);

  return {
    careContexts,
    configuredBudgetTypes,
    hasBudgetSnapshot,
  };
}
