import type { ServiceResult } from '@/types';
import type { BudgetListItem } from '@/types/modules/billing';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import {
  mapClientBudgetRowToListItem,
  type ClientBudgetListRow,
} from '@/lib/office/budgetListMapper';
import { SERVICE_ERRORS } from '../errors';

const BUDGET_LIST_SELECT = `
  id, tenant_id, client_id, budget_type, status, budget_year, budget_month,
  monthly_amount, yearly_amount, used_amount, reserved_amount, updated_at,
  clients(first_name, last_name)
` as const;

function getClient() {
  return getSupabaseClient();
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

/** WP221 — Live Supabase Repository (office budgets list) */
export const budgetSupabaseRepository = {
  wpNumber: 221 as const,
  table: 'client_budgets' as const,

  async list(tenantId: string): Promise<ServiceResult<BudgetListItem[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const { data, error } = await supabase
      .from('client_budgets')
      .select(BUDGET_LIST_SELECT)
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const rows = (data ?? []) as ClientBudgetListRow[];
    return { ok: true, data: rows.map(mapClientBudgetRowToListItem) };
  },
};
