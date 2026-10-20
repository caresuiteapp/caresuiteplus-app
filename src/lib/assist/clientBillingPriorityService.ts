import type { ServiceResult } from '@/types';
import type {
  ClientBillingPriorityRule,
  ClientCareGrade,
} from '@/types/assist/clientAssistBilling';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { mapPriorityRuleRow } from './clientAssistBillingMappers';
import { listBudgetTemplatesByYear } from './budgetTemplateCatalogService';

/** Default priority order per spec §11 — from catalog when no client/tenant override. */
export const DEFAULT_CATALOG_PRIORITY: Record<string, number> = {
  paragraph_45b: 1,
  umwandlung_pg2: 2,
  umwandlung_pg3: 2,
  umwandlung_pg4: 2,
  umwandlung_pg5: 2,
  verhinderungspflege: 3,
  kurzzeitpflege: 4,
  gemeinsames_jahresbudget: 5,
  selbstzahler: 90,
  kulanz: 91,
  ungeklaert: 99,
};

export async function listClientBillingPriorityRules(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientBillingPriorityRule[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, 'client_billing_priority_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .or(`client_id.eq.${clientId},client_id.is.null`)
      .eq('is_active', true)
      .order('priority_order', { ascending: true });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    const rules = (data ?? []).map((row) => mapPriorityRuleRow(row as Record<string, unknown>));
    const clientRules = rules.filter((r) => r.clientId === clientId);
    if (clientRules.length > 0) return { ok: true, data: clientRules };

    const tenantDefaults = rules.filter((r) => r.clientId == null);
    if (tenantDefaults.length > 0) return { ok: true, data: tenantDefaults };

    const catalog = await listBudgetTemplatesByYear(new Date().getFullYear());
    if (!catalog.ok) return catalog;

    const synthetic: ClientBillingPriorityRule[] = catalog.data.map((t) => ({
      id: `default-${t.catalogKey}`,
      tenantId,
      clientId: null,
      catalogKey: t.catalogKey,
      priorityOrder: t.billingPriority,
      isActive: true,
      notes: 'Katalog-Standard',
    }));

    return { ok: true, data: synthetic.sort((a, b) => a.priorityOrder - b.priorityOrder) };
  });
}

export function sortAccountsByPriority<T extends { catalogKey: string; billingPriority: number }>(
  accounts: T[],
  rules: ClientBillingPriorityRule[],
): T[] {
  const priorityMap = new Map<string, number>();
  for (const rule of rules) {
    priorityMap.set(rule.catalogKey, rule.priorityOrder);
  }
  return [...accounts].sort((a, b) => {
    const pa = priorityMap.get(a.catalogKey) ?? a.billingPriority ?? 99;
    const pb = priorityMap.get(b.catalogKey) ?? b.billingPriority ?? 99;
    return pa - pb;
  });
}

export function resolvePrimaryBillingCatalogKey(
  careGrade: ClientCareGrade | null,
  rules: ClientBillingPriorityRule[],
): string {
  const sorted = [...rules].sort((a, b) => a.priorityOrder - b.priorityOrder);
  const statutory = sorted.find((r) =>
    r.catalogKey === 'paragraph_45b'
    || r.catalogKey.startsWith('umwandlung_'),
  );
  if (statutory) return statutory.catalogKey;
  return sorted[0]?.catalogKey ?? 'paragraph_45b';
}
