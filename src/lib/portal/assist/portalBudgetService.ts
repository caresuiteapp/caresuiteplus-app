import type { ServiceResult } from '@/types';
import type { PortalBudgetSnapshot, PortalBudgetType } from '@/types/portal/assist';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapBudgetRow(row: Record<string, unknown>): PortalBudgetSnapshot {
  return {
    id: String(row.id ?? ''),
    tenantId: String(row.tenant_id ?? ''),
    clientId: String(row.client_id ?? ''),
    budgetType: String(row.budget_type ?? 'paragraph_45b') as PortalBudgetType,
    periodStart: String(row.period_start ?? ''),
    periodEnd: String(row.period_end ?? ''),
    totalAmount: Number(row.total_amount ?? 0),
    usedAmount: Number(row.used_amount ?? 0),
    remainingAmount: Number(row.remaining_amount ?? 0),
    currency: String(row.currency ?? 'EUR'),
  };
}

/** Read latest §45b budget snapshot for client — empty when none released. */
export async function fetchPortalBudgetSnapshot(
  tenantId: string,
  clientId: string,
  budgetType: PortalBudgetType = 'paragraph_45b',
): Promise<ServiceResult<PortalBudgetSnapshot | null>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'portal_budget_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('budget_type', budgetType)
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) return { ok: true, data: null };
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    if (!data) return { ok: true, data: null };
    return { ok: true, data: mapBudgetRow(data as Record<string, unknown>) };
  });
}
