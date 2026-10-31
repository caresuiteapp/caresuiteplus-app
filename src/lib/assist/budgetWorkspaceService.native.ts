// Generated native presentation from src/lib/assist/budgetWorkspaceService.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { ServiceResult } from '@/types';
import type { ClientAssistBillingProfile, ClientBudgetTransaction, ClientCareGrade } from '@/types/assist/clientAssistBilling';
import { isConversionEligibleForGrade, BUDGET_TEMPLATE_LABELS } from '@/types/assist/clientAssistBilling';
import { normalizeClientFundingSources, isCatalogKeySelected, type ClientFundingSourceKey } from '@/types/clients/clientFundingSource';
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { mapBudgetAccountRow, mapCareEntitlementRow, mapCatalogRow, mapPriorityRuleRow, mapServiceEntitlementRow, mapTransactionRow } from './clientAssistBillingMappers';
import { filterTemplatesForCareGrade } from './budgetTemplateCatalogService';
import { sortAccountsByPriority } from './clientBillingPriorityService';
import { buildWorkspaceWarnings, currentBudgetDate, currentWorkspaceAccounts, projectWorkspacePlanning, validBudgetDate, workspaceAvailability, type BudgetPlanningVisit, type BudgetPlanningAllocation, type BudgetReservation } from "./budgetWorkspaceModel.native.ts";
export type BudgetWorkspaceProfile = ClientAssistBillingProfile & {
    planningProjection: {
        additionalCents: number;
        unallocatedCents: number;
        unpricedVisits: number;
    };
    fundingSelection: {
        id: string;
        sources: ClientFundingSourceKey[];
        effectiveFrom: string;
    } | null;
    careGradeNeedsConfirmation: boolean;
};
export type BudgetWorkspaceTransaction = ClientBudgetTransaction & {
    lifecycleStatus?: string | null;
};
function legacyGrade(value: unknown): ClientCareGrade | null {
    const normalized = String(value ?? '').toLocaleLowerCase('de-DE').replace(/\s+/g, '');
    const grade = normalized.match(/^(?:pg|pflegegrad)?([1-5])$/)?.[1];
    if (grade)
        return `pg${grade}` as ClientCareGrade;
    if (['none', 'kein', 'unknown', 'unbekannt'].includes(normalized))
        return 'kein';
    return normalized === 'hospiz' ? 'hospiz' : null;
}
type ReadPage = {
    data: Record<string, unknown>[] | null;
    error: Parameters<typeof toGermanSupabaseError>[0];
};
async function readAll(makePage: (from: number, to: number) => PromiseLike<ReadPage>): Promise<ReadPage> {
    const data: Record<string, unknown>[] = [];
    for (let offset = 0;; offset += 500) {
        const result = await makePage(offset, offset + 499);
        if (result.error)
            return result;
        const page = result.data ?? [];
        data.push(...page);
        if (page.length < 500)
            return { data, error: null };
    }
}
async function workspaceHourlyRate(tenantId: string, asOfDate: string): Promise<ServiceResult<number | null>> {
    const client = getSupabaseClient();
    if (!client)
        return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
    const catalog = await fromUnknownTable(client, 'tenant_service_catalog').select('id,service_key,sort_order').eq('tenant_id', tenantId).eq('module_key', 'assist').eq('category', 'service').eq('unit', 'hour').eq('is_active', true);
    if (catalog.error)
        return { ok: false, error: toGermanSupabaseError(catalog.error) };
    const preferred = ['assist.entlastung_45b', 'assist.alltagsbegleitung', 'assist.verhinderungspflege_39'];
    const rank = (row: Record<string, unknown>) => { const i = preferred.indexOf(String(row.service_key)); return i < 0 ? 100 + Number(row.sort_order ?? 0) : i; };
    const rows = [...(catalog.data ?? [])].sort((a, b) => rank(a) - rank(b));
    if (!rows.length)
        return { ok: true, data: null };
    const prices = await fromUnknownTable(client, 'tenant_service_prices').select('catalog_id,price_net,valid_from,valid_to').eq('tenant_id', tenantId).eq('is_default', true).in('catalog_id', rows.map((row) => row.id)).lte('valid_from', asOfDate).order('valid_from', { ascending: false });
    if (prices.error)
        return { ok: false, error: toGermanSupabaseError(prices.error) };
    for (const row of rows) {
        const price = (prices.data ?? []).find((item) => item.catalog_id === row.id && (!item.valid_to || String(item.valid_to) >= asOfDate) && Number.isFinite(Number(item.price_net)) && Number(item.price_net) > 0);
        if (price)
            return { ok: true, data: Math.round(Number(price.price_net) * 100) };
    }
    return { ok: true, data: null };
}
/** A read never synchronizes legacy records, creates accounts or persists warnings. */
export async function getBudgetWorkspaceProfile(input: {
    tenantId: string;
    clientId: string;
    date?: string | Date;
}): Promise<ServiceResult<BudgetWorkspaceProfile>> {
    return runService(async () => {
        const denied = guardServiceTenant(input.tenantId);
        if (denied)
            return denied;
        const asOfDate = input.date instanceof Date ? (Number.isFinite(input.date.getTime()) ? input.date.toISOString().slice(0, 10) : '') : input.date ?? currentBudgetDate();
        if (!validBudgetDate(asOfDate))
            return { ok: false, error: 'Bitte ein gültiges Budgetdatum wählen.' };
        const client = getSupabaseClient();
        if (!client)
            return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
        const { tenantId, clientId } = input;
        const budgetYear = Number(asOfDate.slice(0, 4));
        const monthStart = `${asOfDate.slice(0, 7)}-01`;
        const monthEnd = new Date(Date.UTC(budgetYear, Number(asOfDate.slice(5, 7)), 0, 12)).toISOString().slice(0, 10);
        const scoped = (table: string) => fromUnknownTable(client, table).select('*').eq('tenant_id', tenantId).eq('client_id', clientId);
        const [person, entitlements, services, templates, priorities, modes, funding, accountsResult, visitsResult, allocationsResult, reservationsResult, rateResult] = await Promise.all([
            client.from('clients').select('id,care_level').eq('tenant_id', tenantId).eq('id', clientId).maybeSingle(),
            scoped('client_care_entitlement').lte('valid_from', asOfDate).order('valid_from', { ascending: false }),
            scoped('client_service_entitlements').eq('is_active', true).lte('valid_from', asOfDate),
            fromUnknownTable(client, 'budget_template_catalog').select('*').eq('budget_year', budgetYear).eq('is_active', true),
            fromUnknownTable(client, 'client_billing_priority_rules').select('*').eq('tenant_id', tenantId).or(`client_id.eq.${clientId},client_id.is.null`).eq('is_active', true).order('priority_order', { ascending: true }),
            scoped('client_budget_mode').eq('budget_year', budgetYear).maybeSingle(),
            scoped('client_funding_selections').is('replaced_at', null).maybeSingle(),
            readAll((from, to) => scoped('client_budget_accounts').order('id').range(from, to)),
            readAll((from, to) => fromUnknownTable(client, 'assist_visits').select('id,legacy_assignment_id,assignment_date,planned_start_at,planned_end_at,duration_minutes,budget_amount_cents,billing_budget_source_key,planning_status,execution_status,canonical_status').eq('tenant_id', tenantId).eq('client_id', clientId).gte('assignment_date', monthStart).lte('assignment_date', monthEnd).order('id').range(from, to)),
            readAll((from, to) => scoped('assignment_budget_allocations').in('allocation_status', ['planned', 'reserved']).order('id').range(from, to)),
            readAll((from, to) => scoped('client_budget_transactions').eq('transaction_type', 'reservation').or('lifecycle_status.is.null,lifecycle_status.in.(geplant,durchgefuehrt)').order('id').range(from, to)),
            workspaceHourlyRate(tenantId, asOfDate),
        ]);
        for (const result of [person, entitlements, services, templates, priorities, modes, funding, accountsResult, visitsResult, allocationsResult, reservationsResult]) {
            if (result.error)
                return { ok: false, error: toGermanSupabaseError(result.error) };
        }
        if (!person.data)
            return { ok: false, error: 'Klient:in nicht gefunden oder nicht freigegeben.' };
        const rows = (data: unknown): Record<string, unknown>[] => Array.isArray(data) ? data as Record<string, unknown>[] : [];
        const careEntitlement = rows(entitlements.data).filter((row) => !row.valid_until || String(row.valid_until) >= asOfDate).map(mapCareEntitlementRow)[0] ?? null;
        let careGrade: ClientCareGrade | null = careEntitlement?.careGrade ?? null;
        let insuranceData: Record<string, unknown> | null | undefined;
        if (!careEntitlement) {
            const legacy = await scoped('client_care_levels').lte('valid_from', asOfDate).order('valid_from', { ascending: false });
            if (legacy.error)
                return { ok: false, error: toGermanSupabaseError(legacy.error) };
            const currentLegacy = rows(legacy.data).find((row) => !row.valid_until || String(row.valid_until) >= asOfDate);
            careGrade = legacyGrade(currentLegacy?.grade) ?? legacyGrade(person.data.care_level);
            if (!careGrade) {
                const insurance = await scoped('client_insurance_profiles').eq('is_primary', true).maybeSingle();
                if (insurance.error)
                    return { ok: false, error: toGermanSupabaseError(insurance.error) };
                insuranceData = insurance.data;
                careGrade = legacyGrade(insuranceData?.care_level);
            }
        }
        const serviceEntitlements = rows(services.data).filter((row) => !row.valid_until || String(row.valid_until) >= asOfDate).map(mapServiceEntitlementRow);
        let fundingSources: ClientFundingSourceKey[];
        if (funding.data)
            fundingSources = normalizeClientFundingSources(Array.isArray(funding.data.sources) ? funding.data.sources : []);
        else {
            if (insuranceData === undefined) {
                const insurance = await scoped('client_insurance_profiles').eq('is_primary', true).maybeSingle();
                if (insurance.error)
                    return { ok: false, error: toGermanSupabaseError(insurance.error) };
                insuranceData = insurance.data;
            }
            fundingSources = normalizeClientFundingSources([
                ...(careGrade && careGrade !== 'kein' && careGrade !== 'hospiz' ? ['entlastungsleistung'] : []),
                ...(careEntitlement?.conversionEnabled ? ['umwandlung'] : []),
                ...(serviceEntitlements.some((s) => s.serviceTypeKey?.includes('verhinderung')) ? ['verhinderungspflege'] : []),
                ...(insuranceData?.self_pay || serviceEntitlements.some((s) => ['self_payer', 'mixed'].includes(s.billingMode)) ? ['selbstzahler'] : []),
            ]);
        }
        const applicableTemplates = filterTemplatesForCareGrade(rows(templates.data).map(mapCatalogRow), careGrade).filter((template) => isCatalogKeySelected(template.catalogKey, fundingSources));
        const allRules = rows(priorities.data).map(mapPriorityRuleRow);
        const clientRules = allRules.filter((rule) => rule.clientId === clientId);
        const priorityRules = clientRules.length ? clientRules : allRules.length ? allRules : applicableTemplates.map((template) => ({ id: `catalog:${template.id}`, tenantId, clientId: null, catalogKey: template.catalogKey, priorityOrder: template.billingPriority, isActive: true, notes: 'Katalogstandard' }));
        const labelMap = new Map(applicableTemplates.map((template) => [template.catalogKey, template.label]));
        const rawAccounts = rows(accountsResult.data).map((row) => mapBudgetAccountRow(row, labelMap.get(String(row.catalog_key))?.trim() || BUDGET_TEMPLATE_LABELS[String(row.catalog_key) as keyof typeof BUDGET_TEMPLATE_LABELS])).filter((account) => isCatalogKeySelected(account.catalogKey, fundingSources)).map((account) => ({ ...account, billingPriority: priorityRules.find((rule) => rule.catalogKey === account.catalogKey)?.priorityOrder ?? account.billingPriority }));
        const catalogHourlyRateCents = rateResult.ok ? rateResult.data : null;
        const rates = [...new Set(serviceEntitlements.map((s) => s.hourlyRateCents).filter((rate): rate is number => rate != null && rate > 0))];
        const hourlyRateCents = rates.length === 1 ? rates[0] : rates.length > 1 ? null : catalogHourlyRateCents;
        const monthVisits = rows(visitsResult.data).filter((row) => String(row.assignment_date) >= monthStart && String(row.assignment_date) <= monthEnd);
        const planning = projectWorkspacePlanning({ accounts: rawAccounts, visits: monthVisits as unknown as BudgetPlanningVisit[], allocations: rows(allocationsResult.data) as unknown as BudgetPlanningAllocation[], reservations: rows(reservationsResult.data) as unknown as BudgetReservation[], hourlyRateCents });
        const current = sortAccountsByPriority(currentWorkspaceAccounts(planning.accounts, asOfDate), priorityRules);
        const profile: BudgetWorkspaceProfile = {
            asOfDate, budgetYear, careGrade, careEntitlement, fundingSources,
            conversionEligible: isConversionEligibleForGrade(careGrade) && careEntitlement?.conversionEnabled === true,
            carePreventionMode: modes.data?.care_prevention_mode === 'joint_annual_budget' ? 'joint_annual_budget' : 'separate_preventive_short_term',
            serviceEntitlements, catalogHourlyRateCents, budgetAccounts: current, budgetVisualAccounts: current, priorityRules,
            templates: applicableTemplates, warnings: [], canUseBudgetByCatalogKey: {},
            planningProjection: { additionalCents: planning.additionalCents, unallocatedCents: planning.unallocatedCents, unpricedVisits: planning.unpricedVisits },
            fundingSelection: funding.data ? { id: String(funding.data.id), sources: normalizeClientFundingSources(Array.isArray(funding.data.sources) ? funding.data.sources : []), effectiveFrom: String(funding.data.effective_from) } : null,
            careGradeNeedsConfirmation: !careEntitlement && careGrade != null,
        };
        profile.canUseBudgetByCatalogKey = workspaceAvailability(current, profile);
        profile.warnings = buildWorkspaceWarnings(tenantId, clientId, profile, profile.planningProjection, rows(accountsResult.data).map((row) => mapBudgetAccountRow(row)));
        if (profile.careGradeNeedsConfirmation)
            profile.warnings.unshift({ id: 'current:care_entitlement_unconfirmed', tenantId, clientId, warningType: 'care_entitlement_unconfirmed', severity: 'warning', catalogKey: null, budgetAccountId: null, message: 'Der Pflegegrad stammt aus der Klientenakte. Bitte den Anspruch mit seinem gültigen Beginn bestätigen, bevor Budgetkonten angelegt werden.', isResolved: false, resolvedAt: null, createdAt: `${asOfDate}T12:00:00Z` });
        if (!rateResult.ok)
            profile.warnings.push({ id: 'current:hourly_rate', tenantId, clientId, warningType: 'hourly_rate_unavailable', severity: 'warning', catalogKey: null, budgetAccountId: null, message: 'Der Katalogpreis konnte nicht geladen werden. Stundenprognosen und noch unbewertete Einsätze können unvollständig sein.', isResolved: false, resolvedAt: null, createdAt: `${asOfDate}T12:00:00Z` });
        return { ok: true, data: profile };
    });
}
/** History includes closed accounts and supports stable pagination. */
export async function listBudgetWorkspaceTransactions(tenantId: string, clientId: string, filters: {
    transactionType?: string;
    catalogKey?: string;
    budgetYear?: number;
    limit?: number;
    offset?: number;
} = {}): Promise<ServiceResult<BudgetWorkspaceTransaction[]>> {
    return runService(async () => {
        const denied = guardServiceTenant(tenantId);
        if (denied)
            return denied;
        const client = getSupabaseClient();
        if (!client)
            return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
        const accounts = await readAll((from, to) => {
            let query = fromUnknownTable(client, 'client_budget_accounts').select('id,catalog_key,catalog_snapshot').eq('tenant_id', tenantId).eq('client_id', clientId);
            if (filters.budgetYear != null)
                query = query.eq('catalog_year', filters.budgetYear);
            if (filters.catalogKey)
                query = query.eq('catalog_key', filters.catalogKey);
            return query.order('id').range(from, to);
        });
        if (accounts.error)
            return { ok: false, error: toGermanSupabaseError(accounts.error) };
        const accountMap = new Map((accounts.data ?? []).map((row) => [String(row.id), row]));
        if (!accountMap.size)
            return { ok: true, data: [] };
        let query = fromUnknownTable(client, 'client_budget_transactions').select('*').eq('tenant_id', tenantId).eq('client_id', clientId).in('budget_account_id', [...accountMap.keys()]).order('created_at', { ascending: false }).order('id', { ascending: false });
        if (filters.transactionType)
            query = query.eq('transaction_type', filters.transactionType);
        const offset = Math.max(0, Math.floor(filters.offset ?? 0));
        const limit = Math.min(501, Math.max(1, Math.floor(filters.limit ?? 51)));
        const result = await query.range(offset, offset + limit - 1);
        if (result.error)
            return { ok: false, error: toGermanSupabaseError(result.error) };
        return { ok: true, data: (result.data ?? []).map((row) => {
                const tx = mapTransactionRow(row);
                const account = accountMap.get(tx.budgetAccountId);
                const key = String(account?.catalog_key ?? '');
                const snapshot = account?.catalog_snapshot as Record<string, unknown> | undefined;
                return { ...tx, lifecycleStatus: typeof row.lifecycle_status === 'string' ? row.lifecycle_status : null, catalogKey: key, accountLabel: typeof snapshot?.label === 'string' && snapshot.label.trim() ? snapshot.label : BUDGET_TEMPLATE_LABELS[key as keyof typeof BUDGET_TEMPLATE_LABELS] ?? key };
            }) };
    });
}
