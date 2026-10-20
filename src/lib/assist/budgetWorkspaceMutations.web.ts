/** Web-only authoritative budget mutations. Reads and previews never mutate records. */
import type { ClientBudgetAccount, ClientCareEntitlement, ClientCareGrade, BudgetTemplateCatalogEntry } from '@/types/assist/clientAssistBilling';
import { gradeMatchesTemplate, isConversionEligibleForGrade } from '@/types/assist/clientAssistBilling';
import type { ClientFundingSourceKey } from '@/types/clients/clientFundingSource';
import { isCatalogKeySelected } from '@/types/clients/clientFundingSource';
import type { ClientFundingSelection } from '@/lib/clients/clientFundingSourceService';
import type { BudgetRecalcDiff as LegacyBudgetRecalcDiff, BudgetCorrectionInput } from './clientCareGradeBudgetsService';
import type { UpdateClientBudgetAccountInput } from './clientBudgetAccountService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { mapBudgetAccountRow, mapCareEntitlementRow, mapCatalogRow } from './clientAssistBillingMappers';

export type BudgetWorkspaceResult<T> = { ok: true; data: T } | { ok: false; error: string; uncertain?: boolean; operationId?: string };
export type BudgetRecalcDiff = LegacyBudgetRecalcDiff & {
  create?: boolean; catalogTemplateId?: string; catalogYear?: number;
  periodStart?: string; periodEnd?: string; asOfDate?: string;
};
type Row = Record<string, unknown>;
type Database = NonNullable<ReturnType<typeof getSupabaseClient>>;
type RpcError = Parameters<typeof toGermanSupabaseError>[0];
type RpcClient = { rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: RpcError }> };
type RetainedOperation = { tenantId: string; clientId: string; action: string; input: Row };
const operations = new Map<string, RetainedOperation>();
function retainedInput(operationId: string | undefined, tenantId: string, clientId: string, action: string): Row | null {
  const retained = operationId ? operations.get(operationId) : null;
  return retained && retained.tenantId === tenantId && retained.clientId === clientId && retained.action === action ? retained.input : null;
}
function intent(input: Row) { const { expectedEntitlement: _e, expectedUpdatedAt: _a, ...rest } = input; return JSON.stringify(rest); }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GRADES = ['kein', 'pg1', 'pg2', 'pg3', 'pg4', 'pg5', 'hospiz'];
const SOURCES = ['entlastungsleistung', 'umwandlung', 'verhinderungspflege', 'selbstzahler'];
const uncertainMessage = 'Die Speicherbestätigung fehlt. Bitte die Übersicht neu laden und den Stand prüfen, bevor dieselbe Änderung erneut ausgeführt wird.';
const failure = (error: string): { ok: false; error: string } => ({ ok: false, error });
const row = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const cents = (value: unknown, signed = false) => typeof value === 'number' && Number.isSafeInteger(value) && (signed || value >= 0);
const reasonValid = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 2000;
function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1995-01-01' || value > '2200-12-31') return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validateScope(tenantId: string, clientId: string): BudgetWorkspaceResult<Database> {
  const denied = guardServiceTenant(tenantId); if (denied) return denied;
  if (!UUID.test(tenantId) || !UUID.test(clientId)) return failure('Mandant oder Klient:in ist ungültig.');
  const client = getSupabaseClient();
  return client ? { ok: true, data: client } : failure(SERVICE_ERRORS.supabaseUnavailable);
}
function entitlementValid(data: unknown, tenantId: string, clientId: string): data is Row {
  return row(data) && typeof data.id === 'string' && UUID.test(data.id) && data.tenant_id === tenantId && data.client_id === clientId
    && GRADES.includes(String(data.care_grade)) && typeof data.valid_from === 'string' && validDate(data.valid_from)
    && typeof data.conversion_enabled === 'boolean';
}
function accountValid(data: unknown, tenantId: string, clientId: string): data is Row {
  return row(data) && typeof data.id === 'string' && UUID.test(data.id) && data.tenant_id === tenantId && data.client_id === clientId
    && ['allocated_cents', 'used_cents', 'reserved_cents'].every((key) => cents(Number(data[key])))
    && typeof data.catalog_key === 'string' && ['active', 'suspended'].includes(String(data.status));
}
function receiptData(value: unknown, tenantId: string, clientId: string, requestId: string, action: string): unknown {
  if (!row(value) || value.requestId !== requestId || value.action !== action || value.tenantId !== tenantId || value.clientId !== clientId || !row(value.data)) return undefined;
  return value.data;
}
/** A successful receipt is written in the same DB transaction as all domain rows. */
async function mutate<T>(tenantId: string, clientId: string, action: string, input: Row, decode: (data: unknown) => T | null, operationId?: string): Promise<BudgetWorkspaceResult<T>> {
  const scope = validateScope(tenantId, clientId); if (!scope.ok) return scope;
  const requestId = operationId ?? globalThis.crypto?.randomUUID?.();
  if (!requestId || !UUID.test(requestId)) return failure('Die sichere Auftragskennung konnte nicht erstellt werden. Bitte neu laden.');
  const rpc = scope.data as unknown as RpcClient;
  const retained = operations.get(requestId);
  if (retained && (retained.tenantId !== tenantId || retained.clientId !== clientId || retained.action !== action || intent(retained.input) !== intent(input))) return failure('Diese Auftragskennung gehört zu einer anderen Änderung.');
  const writeInput = retained?.input ?? JSON.parse(JSON.stringify(input)) as Row;
  operations.set(requestId, { tenantId, clientId, action, input: writeInput });
  let knownError: RpcError = null;
  try {
    const reply = await rpc.rpc('mutate_budget_workspace', { p_tenant_id: tenantId, p_client_id: clientId, p_request_id: requestId, p_action: action, p_input: writeInput });
    knownError = reply.error;
    if (!reply.error) {
      const decoded = decode(receiptData(reply.data, tenantId, clientId, requestId, action));
      if (decoded !== null) { operations.delete(requestId); return { ok: true, data: decoded }; }
    }
  } catch { /* A lost HTTP response does not prove the database rolled back. */ }
  try {
    const receipt = await rpc.rpc('get_budget_workspace_receipt', { p_tenant_id: tenantId, p_client_id: clientId, p_request_id: requestId });
    if (!receipt.error) {
      const decoded = decode(receiptData(receipt.data, tenantId, clientId, requestId, action));
      if (decoded !== null) { operations.delete(requestId); return { ok: true, data: decoded }; }
    }
  } catch { /* Keep the form; never claim a failed write was definitely absent. */ }
  const code = row(knownError) ? String(knownError.code ?? '') : '';
  // PostgreSQL statement errors are authoritative rollbacks. Transport, proxy and malformed receipts are not.
  if (/^(22|23|40|42|P0)/.test(code)) { operations.delete(requestId); return failure(toGermanSupabaseError(knownError)); }
  return { ok: false, error: uncertainMessage, uncertain: true, operationId: requestId };
}
async function currentEntitlement(tenantId: string, clientId: string): Promise<BudgetWorkspaceResult<Row | null>> {
  const scope = validateScope(tenantId, clientId); if (!scope.ok) return scope;
  try {
    const response = await fromUnknownTable(scope.data, 'client_care_entitlement').select('*').eq('tenant_id', tenantId).eq('client_id', clientId).is('valid_until', null).limit(2);
    if (response.error) return failure(toGermanSupabaseError(response.error));
    const rows = response.data ?? [];
    if (rows.length > 1) return failure('Mehrere offene Pflegegradansprüche. Bitte die Klientenakte klären.');
    if (!rows.length) return { ok: true, data: null };
    if (!entitlementValid(rows[0], tenantId, clientId) || typeof rows[0].updated_at !== 'string') return failure('Der Pflegegradanspruch konnte nicht sicher geladen werden.');
    return { ok: true, data: rows[0] };
  } catch { return failure('Der Pflegegradanspruch konnte nicht geladen werden. Bitte erneut versuchen.'); }
}
async function careMutation(tenantId: string, clientId: string, action: string, input: Row, operationId?: string, expectedEntitlement?: ClientCareEntitlement | null): Promise<BudgetWorkspaceResult<ClientCareEntitlement>> {
  if (!reasonValid(input.reason)) return failure('Bitte eine Begründung mit höchstens 2000 Zeichen angeben.');
  const retained = retainedInput(operationId, tenantId, clientId, action);
  if (retained) return mutate(tenantId, clientId, action, { ...input, reason: input.reason.trim(), expectedEntitlement: retained.expectedEntitlement }, (data) => entitlementValid(data, tenantId, clientId) ? mapCareEntitlementRow(data) : null, operationId);
  const current = await currentEntitlement(tenantId, clientId); if (!current.ok) return current;
  if (expectedEntitlement !== undefined) {
    const loaded = current.data ? mapCareEntitlementRow(current.data) : null;
    const fields = ['id', 'careGrade', 'validFrom', 'conversionEnabled', 'careFundName', 'careFundMemberId'] as const;
    if ((expectedEntitlement === null) !== (loaded === null) || (expectedEntitlement && loaded && fields.some((key) => expectedEntitlement[key] !== loaded[key]))) return failure('Der Pflegegradanspruch wurde seit dem Öffnen geändert. Bitte die Übersicht neu laden und Ihre Eingaben prüfen.');
  }
  return mutate(tenantId, clientId, action, { ...input, reason: input.reason.trim(), expectedEntitlement: current.data ? { id: current.data.id, updatedAt: current.data.updated_at } : null }, (data) => entitlementValid(data, tenantId, clientId) ? mapCareEntitlementRow(data) : null, operationId);
}
export function changeClientCareGrade(tenantId: string, clientId: string, input: { newCareGrade: ClientCareGrade; effectiveFrom: string; reason: string }, operationId?: string, expectedEntitlement?: ClientCareEntitlement | null) {
  if (!GRADES.includes(input.newCareGrade) || !validDate(input.effectiveFrom) || input.effectiveFrom > today()) return Promise.resolve(failure('Bitte Pflegegrad und ein gültiges Datum bis heute angeben.'));
  return careMutation(tenantId, clientId, 'change_grade', input, operationId, expectedEntitlement);
}
export function updateClientCareFund(tenantId: string, clientId: string, input: { careFundName: string; careFundMemberId: string; reason: string }, operationId?: string, expectedEntitlement?: ClientCareEntitlement | null) {
  if (!input.careFundName.trim() || input.careFundName.length > 240 || input.careFundMemberId.length > 120) return Promise.resolve(failure('Bitte Pflegekasse und Versichertennummer prüfen.'));
  return careMutation(tenantId, clientId, 'update_fund', input, operationId, expectedEntitlement);
}
export function updateCareEntitlementValidFrom(tenantId: string, clientId: string, input: { validFrom: string; reason: string }, operationId?: string, expectedEntitlement?: ClientCareEntitlement | null) {
  if (!validDate(input.validFrom) || input.validFrom > today()) return Promise.resolve(failure('Bitte ein gültiges Gültigkeitsdatum bis heute angeben.'));
  return careMutation(tenantId, clientId, 'update_valid_from', input, operationId, expectedEntitlement);
}
export function setClientConversionEnabled(tenantId: string, clientId: string, enabled: boolean, reason: string, operationId?: string, expectedEntitlement?: ClientCareEntitlement | null) {
  if (typeof enabled !== 'boolean') return Promise.resolve(failure('Bitte den Umwandlungsstatus prüfen.'));
  return careMutation(tenantId, clientId, 'set_conversion', { enabled, reason }, operationId, expectedEntitlement);
}
async function accountMutation<T>(tenantId: string, clientId: string, accountId: string, action: string, input: Row, decode: (data: unknown) => T | null, operationId?: string, expectedAccount?: ClientBudgetAccount): Promise<BudgetWorkspaceResult<T>> {
  if (!UUID.test(accountId) || !reasonValid(input.reason)) return failure('Bitte Budgetkonto und Begründung prüfen.');
  const retained = retainedInput(operationId, tenantId, clientId, action);
  if (retained) return mutate(tenantId, clientId, action, { ...input, reason: input.reason.trim(), accountId, expectedUpdatedAt: retained.expectedUpdatedAt }, decode, operationId);
  const scope = validateScope(tenantId, clientId); if (!scope.ok) return scope;
  try {
    const response = await fromUnknownTable(scope.data, 'client_budget_accounts').select('*').eq('tenant_id', tenantId).eq('client_id', clientId).eq('id', accountId).maybeSingle();
    if (response.error) return failure(toGermanSupabaseError(response.error));
    if (!accountValid(response.data, tenantId, clientId) || typeof response.data.updated_at !== 'string') return failure('Das Budgetkonto konnte nicht sicher geladen werden.');
    if (expectedAccount && (expectedAccount.id !== accountId || (input.externalSachleistungCents !== undefined && (expectedAccount.externalSachleistungCents ?? 0) !== Number(response.data.external_sachleistung_cents ?? 0)))) return failure('Der Betrag wurde seit dem Öffnen geändert. Bitte die Übersicht neu laden und Ihre Eingaben prüfen.');
    return mutate(tenantId, clientId, action, { ...input, reason: input.reason.trim(), accountId, expectedUpdatedAt: response.data.updated_at }, decode, operationId);
  } catch { return failure('Das Budgetkonto konnte nicht geladen werden. Bitte erneut versuchen.'); }
}
export function bookBudgetCorrection(tenantId: string, clientId: string, input: BudgetCorrectionInput, operationId?: string): Promise<BudgetWorkspaceResult<{ transactionId: string }>> {
  if (!cents(input.amountCents, true) || input.amountCents === 0 || !validDate(input.effectiveDate) || input.effectiveDate > today()) return Promise.resolve(failure('Bitte einen gültigen Korrekturbetrag und ein Datum bis heute angeben.'));
  return accountMutation(tenantId, clientId, input.budgetAccountId, 'correction', { amountCents: input.amountCents, effectiveDate: input.effectiveDate, reason: input.reason }, (data) => row(data) && typeof data.transactionId === 'string' && UUID.test(data.transactionId) ? { transactionId: data.transactionId } : null, operationId);
}
export function updateClientBudgetAccount(tenantId: string, clientId: string, accountId: string, input: UpdateClientBudgetAccountInput, operationId?: string, expectedAccount?: ClientBudgetAccount): Promise<BudgetWorkspaceResult<ClientBudgetAccount>> {
  if (Object.entries(input).some(([key, value]) => ['allocatedCents', 'externalSachleistungCents', 'individualAmountCents'].includes(key) && value !== undefined && value !== null && !cents(value))) return Promise.resolve(failure('Bitte einen gültigen Betrag mit höchstens zwei Nachkommastellen angeben.'));
  const { auditReason, ...patch } = input;
  return accountMutation(tenantId, clientId, accountId, 'update_account', { ...patch, reason: auditReason ?? '' }, (data) => accountValid(data, tenantId, clientId) && data.id === accountId ? mapBudgetAccountRow(data) : null, operationId, expectedAccount);
}
export function deactivateClientBudgetAccount(tenantId: string, clientId: string, accountId: string, reason: string, operationId?: string): Promise<BudgetWorkspaceResult<ClientBudgetAccount>> {
  return accountMutation(tenantId, clientId, accountId, 'deactivate', { reason }, (data) => accountValid(data, tenantId, clientId) && data.id === accountId && data.status === 'suspended' && data.is_enabled === false ? mapBudgetAccountRow(data) : null, operationId);
}
export function setBudgetWorkspaceFundingSources(tenantId: string, clientId: string, sources: readonly ClientFundingSourceKey[], effectiveFrom: string, expectedSources: readonly ClientFundingSourceKey[], operationId?: string): Promise<BudgetWorkspaceResult<ClientFundingSelection>> {
  if (!sources.length || new Set(sources).size !== sources.length || sources.some((source) => !SOURCES.includes(source)) || expectedSources.some((source) => !SOURCES.includes(source)) || !validDate(effectiveFrom) || effectiveFrom > today()) return Promise.resolve(failure('Bitte Finanzierungsarten und ein gültiges Datum bis heute angeben.'));
  return mutate(tenantId, clientId, 'set_funding', { sources: [...sources], expectedSources: [...expectedSources], effectiveFrom, reason: 'Finanzierungsarten im Budgetbereich geändert' }, (data) => {
    if (!row(data) || typeof data.id !== 'string' || !UUID.test(data.id) || data.tenant_id !== tenantId || data.client_id !== clientId || JSON.stringify(data.sources) !== JSON.stringify(SOURCES.filter((source) => sources.includes(source as ClientFundingSourceKey))) || data.effective_from !== effectiveFrom || data.replaced_at !== null) return null;
    return { id: data.id, tenantId, clientId, sources: data.sources as ClientFundingSourceKey[], effectiveFrom, replacedAt: null, createdAt: String(data.created_at) };
  }, operationId);
}

function periodBounds(template: BudgetTemplateCatalogEntry, date: string) {
  const year = Number(date.slice(0, 4)); const month = Number(date.slice(5, 7));
  const startMonth = template.period === 'monthly' ? month : template.period === 'quarterly' ? Math.floor((month - 1) / 3) * 3 + 1 : 1;
  const endMonth = template.period === 'monthly' ? startMonth : template.period === 'quarterly' ? startMonth + 2 : 12;
  return { periodStart: `${year}-${String(startMonth).padStart(2, '0')}-01`, periodEnd: template.catalogKey === 'paragraph_45b' ? `${year + 1}-06-30` : new Date(Date.UTC(year, endMonth, 0, 12)).toISOString().slice(0, 10) };
}
function applicable(template: BudgetTemplateCatalogEntry, entitlement: ClientCareEntitlement | null, sources: readonly ClientFundingSourceKey[]) {
  return ['paragraph_45b', 'umwandlung_pg2', 'umwandlung_pg3', 'umwandlung_pg4', 'umwandlung_pg5', 'verhinderungspflege', 'gemeinsames_jahresbudget', 'selbstzahler'].includes(template.catalogKey) && !!entitlement && gradeMatchesTemplate(entitlement.careGrade, template) && isCatalogKeySelected(template.catalogKey, sources)
    && (!['verhinderungspflege', 'gemeinsames_jahresbudget'].includes(template.catalogKey) || isConversionEligibleForGrade(entitlement.careGrade))
    && (!template.catalogKey.startsWith('umwandlung_') || (isConversionEligibleForGrade(entitlement.careGrade) && entitlement.conversionEnabled && template.catalogKey === `umwandlung_${entitlement.careGrade}`));
}
/** The passed profile is presentation context only; preview is built from fresh authoritative reads. */
export async function previewBudgetRecalculationFromCatalog(tenantId: string, clientId: string, budgetYear: number, _careGrade: ClientCareGrade | null, _conversionEligible: boolean, _careEntitlement: ClientCareEntitlement | null, asOfDate = today()): Promise<BudgetWorkspaceResult<BudgetRecalcDiff[]>> {
  if (!validDate(asOfDate) || asOfDate > today() || Number(asOfDate.slice(0, 4)) !== budgetYear) return failure('Bitte einen erreichten Budgetzeitraum im ausgewählten Jahr wählen.');
  const scope = validateScope(tenantId, clientId); if (!scope.ok) return scope;
  try {
    const scoped = (table: string) => fromUnknownTable(scope.data, table).select('*').eq('tenant_id', tenantId).eq('client_id', clientId);
    const replies = await Promise.all([
      fromUnknownTable(scope.data, 'budget_template_catalog').select('*').eq('budget_year', budgetYear).eq('is_active', true),
      scoped('client_budget_accounts').eq('catalog_year', budgetYear), scoped('client_care_entitlement').lte('valid_from', asOfDate).order('valid_from', { ascending: false }),
      scoped('client_funding_selections').is('replaced_at', null).maybeSingle(),
    ]);
    for (const reply of replies) if (reply.error) return failure(toGermanSupabaseError(reply.error));
    const [templatesReply, accountsReply, careReply, fundingReply] = replies;
    if (!row(fundingReply.data) || !Array.isArray(fundingReply.data.sources)) return failure('Bitte zuerst die Finanzierungsarten bestätigen. Danach lassen sich Budgetkonten anlegen oder neu berechnen.');
    const sources = fundingReply.data.sources as ClientFundingSourceKey[];
    const templates = (templatesReply.data as Row[] ?? []).map(mapCatalogRow);
    const accounts = (accountsReply.data as Row[] ?? []).map((r) => mapBudgetAccountRow(r));
    const entitlements = (careReply.data as Row[] ?? []).map(mapCareEntitlementRow);
    const entitlementAt = (start: string, end: string) => entitlements.find((e) => e.validFrom <= end && (!e.validUntil || e.validUntil >= start)) ?? null;
    const diffs: BudgetRecalcDiff[] = [];
    for (const account of accounts) {
      if (account.status !== 'active') continue;
      const template = templates.find((t) => t.catalogKey === account.catalogKey);
      if (!template || template.defaultAmountCents == null || !applicable(template, entitlementAt(account.periodStart, account.periodEnd < asOfDate ? account.periodEnd : asOfDate), sources)) continue;
      const skipReason = budgetYear === 2026 && ['verhinderungspflege', 'kurzzeitpflege'].includes(account.catalogKey) ? 'Getrenntes Bestandskonto zuerst fachlich klären. Für 2026 gilt das gemeinsame Jahresbudget.' : account.catalogKey === 'gemeinsames_jahresbudget' && template.defaultAmountCents > account.allocatedCents && accounts.some((a) => ['verhinderungspflege', 'kurzzeitpflege'].includes(a.catalogKey)) ? 'Gleichzeitig vorhandene getrennte Jahreskonten zuerst klären' : account.isIndividualOverride ? 'Individuelles Budget bleibt erhalten' : account.locked || !account.isEnabled ? 'Gesperrtes Budget bleibt unverändert' : template.defaultAmountCents < account.usedCents + account.reservedCents ? 'Katalogbetrag liegt unter Verbrauch und Reservierungen' : template.defaultAmountCents === account.allocatedCents ? 'Keine Abweichung' : undefined;
      diffs.push({ accountId: account.id, catalogKey: account.catalogKey, label: template.label, currentAllocatedCents: account.allocatedCents, catalogAmountCents: template.defaultAmountCents, deltaCents: template.defaultAmountCents - account.allocatedCents, skipped: !!skipReason, skipReason, asOfDate, periodStart: account.periodStart, periodEnd: account.periodEnd });
    }
    for (const template of templates) {
      if (budgetYear === 2026 && ['verhinderungspflege', 'kurzzeitpflege'].includes(template.catalogKey)) continue;
      if ((!template.autoGenerate && !(budgetYear === 2026 && template.catalogKey === 'gemeinsames_jahresbudget' && template.defaultAmountCents === 353900)) || template.defaultAmountCents == null || !cents(template.defaultAmountCents)) continue;
      const months = template.catalogKey === 'paragraph_45b' ? Array.from({ length: Number(asOfDate.slice(5, 7)) }, (_, index) => `${budgetYear}-${String(index + 1).padStart(2, '0')}-01`) : [asOfDate];
      for (const date of months) {
        const { periodStart, periodEnd } = periodBounds(template, date);
        const endMonth = new Date(Date.UTC(Number(periodStart.slice(0, 4)), Number(periodStart.slice(5, 7)), 0, 12)).toISOString().slice(0, 10);
        const entitlement = entitlementAt(periodStart, template.catalogKey === 'paragraph_45b' && endMonth < asOfDate ? endMonth : asOfDate);
        if (!applicable(template, entitlement, sources) || accounts.some((account) => account.catalogKey === template.catalogKey && account.periodStart === periodStart && account.periodEnd === periodEnd)) continue;
        const conflictingAnnual = template.catalogKey === 'gemeinsames_jahresbudget' && accounts.some((a) => ['verhinderungspflege', 'kurzzeitpflege'].includes(a.catalogKey));
        const conflictingConversion = template.catalogKey.startsWith('umwandlung_') && accounts.some((account) => account.catalogKey.startsWith('umwandlung_') && account.catalogKey !== template.catalogKey && account.periodStart === periodStart && (account.usedCents > 0 || account.reservedCents > 0 || (account.externalSachleistungCents ?? 0) > 0));
        diffs.push({ accountId: `new:${template.id}:${periodStart}`, catalogKey: template.catalogKey, label: template.label, currentAllocatedCents: 0, catalogAmountCents: template.defaultAmountCents, deltaCents: template.defaultAmountCents, skipped: conflictingConversion || conflictingAnnual, skipReason: conflictingAnnual ? 'Getrennte Jahreskonten sind bereits vorhanden. Bestand zuerst fachlich klären.' : conflictingConversion ? 'Umwandlungsbuchungen für einen anderen Pflegegrad im selben Monat zuerst klären' : undefined, create: true, catalogTemplateId: template.id, catalogYear: budgetYear, periodStart, periodEnd, asOfDate });
      }
    }
    return { ok: true, data: diffs };
  } catch { return failure('Die Budgetvorschau konnte nicht geladen werden. Bitte erneut versuchen.'); }
}
export function applyBudgetRecalculation(tenantId: string, clientId: string, diffs: BudgetRecalcDiff[], reason: string, operationId?: string): Promise<BudgetWorkspaceResult<{ updated: number; created: number }>> {
  const changes = diffs.filter((diff) => !diff.skipped && (diff.create || diff.deltaCents !== 0));
  if (!reasonValid(reason) || !changes.length || changes.length > 100 || new Set(changes.map((diff) => diff.accountId)).size !== changes.length || changes.some((diff) => !cents(diff.catalogAmountCents) || !cents(diff.currentAllocatedCents))) return Promise.resolve(failure('Bitte eine gültige Vorschau und eine Begründung angeben.'));
  const asOfDate = changes[0].asOfDate;
  if (!asOfDate || !validDate(asOfDate) || changes.some((diff) => diff.asOfDate !== asOfDate)) return Promise.resolve(failure('Die Budgetvorschau ist unvollständig. Bitte neu laden.'));
  return mutate(tenantId, clientId, 'recalculate', { reason: reason.trim(), asOfDate, diffs: changes.map((diff) => ({ accountId: diff.accountId, currentAllocatedCents: diff.currentAllocatedCents, catalogAmountCents: diff.catalogAmountCents, ...(diff.create ? { create: true, catalogTemplateId: diff.catalogTemplateId, periodStart: diff.periodStart, periodEnd: diff.periodEnd } : {}) })) }, (data) => row(data) && data.updated === changes.length && data.created === changes.filter((diff) => diff.create).length ? { updated: data.updated as number, created: data.created as number } : null, operationId);
}
/** Explicit account initialization uses the same reviewable calculation contract. */
export async function ensureBudgetWorkspaceAccounts(tenantId: string, clientId: string, asOfDate = today()): Promise<BudgetWorkspaceResult<{ updated: number; created: number }>> {
  const preview = await previewBudgetRecalculationFromCatalog(tenantId, clientId, Number(asOfDate.slice(0, 4)), null, false, null, asOfDate);
  if (!preview.ok) return preview;
  const creations = preview.data.filter((diff) => diff.create && !diff.skipped);
  if (!creations.length) return { ok: true, data: { updated: 0, created: 0 } };
  return applyBudgetRecalculation(tenantId, clientId, creations, 'Fehlende Budgetkonten aus dem Katalog angelegt');
}
