import type { ServiceResult } from '@/types';
import type {
  BudgetTemplateCatalogEntry,
  ClientCareGrade,
} from '@/types/assist/clientAssistBilling';
import {
  gradeMatchesTemplate,
  isConversionEligibleForGrade,
} from '@/types/assist/clientAssistBilling';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { mapCatalogRow } from './clientAssistBillingMappers';

export {
  formatBudgetPeriodLabel,
  formatBudgetPeriodLabelCapitalized,
  BUDGET_PERIOD_LABELS,
} from './budgetPeriodLabels';

export async function listBudgetTemplatesByYear(
  budgetYear: number,
): Promise<ServiceResult<BudgetTemplateCatalogEntry[]>> {
  return runService(async () => {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'budget_template_catalog')
      .select('*')
      .eq('budget_year', budgetYear)
      .eq('is_active', true)
      .order('billing_priority', { ascending: true });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []).map((row) => mapCatalogRow(row as Record<string, unknown>)) };
  });
}

export function filterTemplatesForCareGrade(
  templates: BudgetTemplateCatalogEntry[],
  careGrade: ClientCareGrade | null,
): BudgetTemplateCatalogEntry[] {
  return templates.filter((t) => {
    if (t.catalogKey.startsWith('umwandlung_')) {
      if (!isConversionEligibleForGrade(careGrade)) return false;
    }
    return gradeMatchesTemplate(careGrade, t);
  });
}

export function getUmwandlungTemplateKeyForGrade(
  grade: ClientCareGrade | null,
): string | null {
  if (grade === 'pg2') return 'umwandlung_pg2';
  if (grade === 'pg3') return 'umwandlung_pg3';
  if (grade === 'pg4') return 'umwandlung_pg4';
  if (grade === 'pg5') return 'umwandlung_pg5';
  return null;
}

export async function getBudgetTemplateByKey(
  catalogKey: string,
  budgetYear: number,
): Promise<ServiceResult<BudgetTemplateCatalogEntry | null>> {
  return runService(async () => {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'budget_template_catalog')
      .select('*')
      .eq('catalog_key', catalogKey)
      .eq('budget_year', budgetYear)
      .maybeSingle();

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: true, data: null };
    return { ok: true, data: mapCatalogRow(data as Record<string, unknown>) };
  });
}

export async function listApplicableTemplatesForClient(
  tenantId: string,
  careGrade: ClientCareGrade | null,
  budgetYear: number,
): Promise<ServiceResult<BudgetTemplateCatalogEntry[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const all = await listBudgetTemplatesByYear(budgetYear);
    if (!all.ok) return all;
    return { ok: true, data: filterTemplatesForCareGrade(all.data, careGrade) };
  });
}
