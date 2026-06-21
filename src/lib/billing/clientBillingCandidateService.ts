/**
 * K.5 — billing candidates from approved proofs (idempotent, no final invoices).
 */
import type { ServiceResult } from '@/types';
import type {
  BillingBlockingReasonKey,
  BillingCandidateStatus,
  ClientBillingCandidate,
  TenantBillingSettings,
  TenantServiceTypeBillingRule,
} from '@/types/clientBilling';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { fetchVisitProofById, listVisitProofs } from '@/lib/assist/assistVisitProofPersistenceService';
import { listClientBudgetSettings } from '@/lib/client/clientBudgetSettingsService';
import { listClientServiceProfiles, listTenantClientServiceTypes } from '@/lib/client/clientServiceTypeService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  fetchVisitForBilling,
  mapApprovedProofToBillingCandidate,
  type BillingCandidateDraft,
} from './clientProofBillingMapper';
import {
  getBillingBlockingReasons,
  neverFinalizeInvoice,
  resolveCandidateStatus,
} from './clientBillingReadinessService';

const CANDIDATES_TABLE = 'client_billing_candidates';
const TENANT_SETTINGS_TABLE = 'tenant_billing_settings';
const BILLING_RULES_TABLE = 'tenant_service_type_billing_rules';

type CandidateRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  client_service_profile_id: string | null;
  service_type_id: string | null;
  proof_id: string;
  visit_id: string;
  proof_date: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  duration_minutes: number | null;
  quantity: number | null;
  unit: string;
  rate_amount: number | null;
  amount_preview: number;
  currency: string;
  budget_setting_id: string | null;
  budget_type_id: string | null;
  billing_target_type: ClientBillingCandidate['billingTargetType'];
  billing_target_id: string | null;
  status: BillingCandidateStatus;
  blocking_reasons: BillingBlockingReasonKey[];
  source_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function mapCandidateRow(row: CandidateRow): ClientBillingCandidate {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    clientServiceProfileId: row.client_service_profile_id,
    serviceTypeId: row.service_type_id,
    proofId: row.proof_id,
    visitId: row.visit_id,
    proofDate: row.proof_date,
    billingPeriodStart: row.billing_period_start,
    billingPeriodEnd: row.billing_period_end,
    durationMinutes: row.duration_minutes,
    quantity: row.quantity != null ? Number(row.quantity) : null,
    unit: row.unit,
    rateAmount: row.rate_amount != null ? Number(row.rate_amount) : null,
    amountPreviewCents: Number(row.amount_preview),
    currency: row.currency,
    budgetSettingId: row.budget_setting_id,
    budgetTypeId: row.budget_type_id,
    billingTargetType: row.billing_target_type,
    billingTargetId: row.billing_target_id,
    status: row.status,
    blockingReasons: Array.isArray(row.blocking_reasons) ? row.blocking_reasons : [],
    sourceSnapshot: row.source_snapshot ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getTenantBillingSettings(
  tenantId: string,
): Promise<ServiceResult<TenantBillingSettings | null>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, TENANT_SETTINGS_TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      if (isSupabaseMissingTableError(error)) return { ok: true, data: null, tableMissing: true };
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    if (!data) return { ok: true, data: null };

    const row = data as Record<string, unknown>;
    return {
      ok: true,
      data: {
        id: row.id as string,
        tenantId: row.tenant_id as string,
        defaultCurrency: row.default_currency as string,
        defaultUnit: row.default_unit as string,
        defaultTaxMode: row.default_tax_mode as string,
        defaultPaymentTermsDays: Number(row.default_payment_terms_days),
        defaultInvoiceMode: row.default_invoice_mode as TenantBillingSettings['defaultInvoiceMode'],
        requireSignature: row.require_signature as boolean,
        requireApproval: row.require_approval as boolean,
        requireAssignmentDeclaration: row.require_assignment_declaration as boolean,
        allowSelfPayerFallback: row.allow_self_payer_fallback as boolean,
        allowBudgetOverrun: row.allow_budget_overrun as boolean,
      },
    };
  });
}

export async function listTenantServiceTypeBillingRules(
  tenantId: string,
): Promise<ServiceResult<TenantServiceTypeBillingRule[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, BILLING_RULES_TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) {
      if (isSupabaseMissingTableError(error)) return { ok: true, data: [], tableMissing: true };
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return {
      ok: true,
      data: (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        tenantId: row.tenant_id as string,
        serviceTypeId: row.service_type_id as string,
        defaultRateAmount: row.default_rate_amount != null ? Number(row.default_rate_amount) : null,
        defaultUnit: row.default_unit as string,
        defaultBillingTargetType: row.default_billing_target_type as TenantServiceTypeBillingRule['defaultBillingTargetType'],
        requireBudget: row.require_budget as boolean,
        requireSignature: row.require_signature as boolean,
        requireApproval: row.require_approval as boolean,
        requireAssignmentDeclaration: row.require_assignment_declaration as boolean,
        allowSelfPayer: row.allow_self_payer as boolean,
        allowBudgetOverrun: row.allow_budget_overrun as boolean,
        isActive: row.is_active as boolean,
      })),
    };
  });
}

export async function updateTenantServiceTypeBillingRule(
  tenantId: string,
  serviceTypeId: string,
  patch: Partial<{
    defaultRateAmount: number | null;
    requireSignature: boolean;
    requireApproval: boolean;
    requireAssignmentDeclaration: boolean;
    allowSelfPayer: boolean;
    allowBudgetOverrun: boolean;
  }>,
): Promise<ServiceResult<TenantServiceTypeBillingRule>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const update: Record<string, unknown> = {};
    if ('defaultRateAmount' in patch) update.default_rate_amount = patch.defaultRateAmount;
    if ('requireSignature' in patch) update.require_signature = patch.requireSignature;
    if ('requireApproval' in patch) update.require_approval = patch.requireApproval;
    if ('requireAssignmentDeclaration' in patch) {
      update.require_assignment_declaration = patch.requireAssignmentDeclaration;
    }
    if ('allowSelfPayer' in patch) update.allow_self_payer = patch.allowSelfPayer;
    if ('allowBudgetOverrun' in patch) update.allow_budget_overrun = patch.allowBudgetOverrun;

    const { data, error } = await fromUnknownTable(client, BILLING_RULES_TABLE)
      .update(update)
      .eq('tenant_id', tenantId)
      .eq('service_type_id', serviceTypeId)
      .select('*')
      .maybeSingle();

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: false, error: 'Abrechnungsregel nicht gefunden.' };

    const rules = await listTenantServiceTypeBillingRules(tenantId);
    if (!rules.ok) return rules;
    const found = rules.data.find((r) => r.serviceTypeId === serviceTypeId);
    if (!found) return { ok: false, error: 'Abrechnungsregel nicht gefunden.' };
    return { ok: true, data: found };
  });
}

async function resolveBillingContext(
  tenantId: string,
  clientId: string,
  serviceTypeKey: string | null,
): Promise<{
  serviceTypeId: string | null;
  serviceProfileId: string | null;
  billingRule: TenantServiceTypeBillingRule | null;
  budgetSettingId: string | null;
  budgetTypeId: string | null;
  tenantSettings: TenantBillingSettings | null;
}> {
  const [types, profiles, rules, budgets, settings] = await Promise.all([
    listTenantClientServiceTypes(tenantId),
    listClientServiceProfiles(tenantId, clientId),
    listTenantServiceTypeBillingRules(tenantId),
    listClientBudgetSettings(tenantId, clientId),
    getTenantBillingSettings(tenantId),
  ]);

  const typeMatch =
    types.ok && serviceTypeKey
      ? types.data.find((t) => t.serviceTypeKey === serviceTypeKey) ?? null
      : null;
  const profileMatch =
    profiles.ok && typeMatch
      ? profiles.data.find((p) => p.serviceTypeId === typeMatch.id && p.status === 'active') ?? null
      : profiles.ok
        ? profiles.data.find((p) => p.status === 'active') ?? null
        : null;
  const resolvedTypeId = typeMatch?.id ?? profileMatch?.serviceTypeId ?? null;
  const billingRule =
    rules.ok && resolvedTypeId
      ? rules.data.find((r) => r.serviceTypeId === resolvedTypeId) ?? null
      : null;
  const budget =
    budgets.ok && budgets.data.length > 0 ? budgets.data[0] : null;

  return {
    serviceTypeId: resolvedTypeId,
    serviceProfileId: profileMatch?.id ?? null,
    billingRule,
    budgetSettingId: budget?.id ?? null,
    budgetTypeId: budget?.budgetTypeId ?? null,
    tenantSettings: settings.ok ? settings.data : null,
  };
}

function draftToRow(draft: BillingCandidateDraft, status: BillingCandidateStatus, blockingReasons: BillingBlockingReasonKey[]) {
  return {
    tenant_id: draft.tenantId,
    client_id: draft.clientId,
    client_service_profile_id: draft.clientServiceProfileId,
    service_type_id: draft.serviceTypeId,
    proof_id: draft.proofId,
    visit_id: draft.visitId,
    proof_date: draft.proofDate,
    billing_period_start: draft.billingPeriodStart,
    billing_period_end: draft.billingPeriodEnd,
    duration_minutes: draft.durationMinutes,
    quantity: draft.quantity,
    unit: draft.unit,
    rate_amount: draft.rateAmount,
    amount_preview: draft.amountPreviewCents,
    currency: draft.currency,
    budget_setting_id: draft.budgetSettingId,
    budget_type_id: draft.budgetTypeId,
    billing_target_type: draft.billingTargetType,
    billing_target_id: draft.billingTargetId,
    status,
    blocking_reasons: blockingReasons,
    source_snapshot: draft.sourceSnapshot,
  };
}

export async function upsertBillingCandidateFromProof(
  tenantId: string,
  proof: AssistVisitProofRow,
): Promise<ServiceResult<ClientBillingCandidate>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const visit = await fetchVisitForBilling(tenantId, proof.visitId);
    const ctx = await resolveBillingContext(
      tenantId,
      visit?.client_id ?? '',
      visit?.service_key ?? null,
    );

    const mapped = mapApprovedProofToBillingCandidate(tenantId, proof, visit, {
      clientServiceProfileId: ctx.serviceProfileId,
      serviceTypeId: ctx.serviceTypeId,
      rateAmount: ctx.billingRule?.defaultRateAmount ?? null,
      unit: ctx.billingRule?.defaultUnit ?? ctx.tenantSettings?.defaultUnit ?? 'hour',
      currency: ctx.tenantSettings?.defaultCurrency ?? 'EUR',
      budgetSettingId: ctx.budgetSettingId,
      budgetTypeId: ctx.budgetTypeId,
      billingTargetType: ctx.billingRule?.defaultBillingTargetType ?? 'cost_carrier',
    });

    if (typeof mapped === 'object' && mapped !== null && 'ok' in mapped) {
      return mapped as { ok: false; error: string };
    }

    const draft = mapped as BillingCandidateDraft;
    const budgets = await listClientBudgetSettings(tenantId, draft.clientId);
    const blockingReasons = getBillingBlockingReasons({
      source: draft.sourceSnapshot,
      proof,
      budgetSettings: budgets.ok ? budgets.data : [],
      serviceProfileActive: ctx.serviceProfileId != null,
      billingRule: ctx.billingRule,
      tenantSettings: ctx.tenantSettings,
      amountPreviewCents: draft.amountPreviewCents,
    });
    const status = resolveCandidateStatus(blockingReasons, draft.amountPreviewCents);

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, CANDIDATES_TABLE)
      .upsert(draftToRow(draft, status, blockingReasons), { onConflict: 'tenant_id,proof_id' })
      .select('*')
      .single();

    if (error) {
      if (isSupabaseMissingTableError(error)) {
        return { ok: false, error: 'Abrechnungskandidaten-Tabelle fehlt — Migration 0160 anwenden.' };
      }
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return { ok: true, data: mapCandidateRow(data as CandidateRow) };
  });
}

export async function rebuildBillingCandidatePreview(
  tenantId: string,
  proofId: string,
): Promise<ServiceResult<ClientBillingCandidate>> {
  const proof = await fetchVisitProofById(tenantId, proofId);
  if (!proof.ok) return proof;
  if (!proof.data) return { ok: false, error: 'Nachweis nicht gefunden.' };
  return upsertBillingCandidateFromProof(tenantId, proof.data);
}

export async function refreshBillingCandidateStatus(
  tenantId: string,
  candidateId: string,
): Promise<ServiceResult<ClientBillingCandidate>> {
  return runService(async () => {
    const candidate = await getBillingCandidateById(tenantId, candidateId);
    if (!candidate.ok) return candidate;
    if (!candidate.data) return { ok: false, error: 'Kandidat nicht gefunden.' };
    const proof = await fetchVisitProofById(tenantId, candidate.data.proofId);
    if (!proof.ok) return proof;
    if (!proof.data) return { ok: false, error: 'Nachweis nicht gefunden.' };
    return upsertBillingCandidateFromProof(tenantId, proof.data);
  });
}

export async function markCandidateReadyForReview(
  tenantId: string,
  candidateId: string,
): Promise<ServiceResult<ClientBillingCandidate>> {
  return updateCandidateStatus(tenantId, candidateId, 'ready_for_review');
}

export async function blockCandidateWithReasons(
  tenantId: string,
  candidateId: string,
  reasons: BillingBlockingReasonKey[],
): Promise<ServiceResult<ClientBillingCandidate>> {
  return updateCandidateStatus(tenantId, candidateId, 'blocked', reasons);
}

async function updateCandidateStatus(
  tenantId: string,
  candidateId: string,
  status: BillingCandidateStatus,
  blockingReasons?: BillingBlockingReasonKey[],
): Promise<ServiceResult<ClientBillingCandidate>> {
  return runService(async () => {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const patch: Record<string, unknown> = { status };
    if (blockingReasons) patch.blocking_reasons = blockingReasons;

    const { data, error } = await fromUnknownTable(client, CANDIDATES_TABLE)
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', candidateId)
      .select('*')
      .maybeSingle();

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: false, error: 'Kandidat nicht gefunden.' };
    return { ok: true, data: mapCandidateRow(data as CandidateRow) };
  });
}

async function getBillingCandidateById(
  tenantId: string,
  candidateId: string,
): Promise<ServiceResult<ClientBillingCandidate | null>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(client, CANDIDATES_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', candidateId)
    .maybeSingle();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapCandidateRow(data as CandidateRow) };
}

export async function getBillingCandidatesForClient(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientBillingCandidate[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, CANDIDATES_TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('proof_date', { ascending: false });

    if (error) {
      if (isSupabaseMissingTableError(error)) return { ok: true, data: [], tableMissing: true };
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return { ok: true, data: (data ?? []).map((row) => mapCandidateRow(row as CandidateRow)) };
  });
}

export async function getBillingCandidatesForProof(
  tenantId: string,
  proofId: string,
): Promise<ServiceResult<ClientBillingCandidate | null>> {
  return runService(async () => {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(client, CANDIDATES_TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('proof_id', proofId)
      .maybeSingle();

    if (error) {
      if (isSupabaseMissingTableError(error)) return { ok: true, data: null, tableMissing: true };
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    if (!data) return { ok: true, data: null };
    return { ok: true, data: mapCandidateRow(data as CandidateRow) };
  });
}

export async function getDraftableBillingCandidates(
  tenantId: string,
  clientId?: string,
): Promise<ServiceResult<ClientBillingCandidate[]>> {
  return runService(async () => {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    let query = fromUnknownTable(client, CANDIDATES_TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'draftable');

    if (clientId) query = query.eq('client_id', clientId);

    const { data, error } = await query.order('proof_date', { ascending: false });

    if (error) {
      if (isSupabaseMissingTableError(error)) return { ok: true, data: [], tableMissing: true };
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return { ok: true, data: (data ?? []).map((row) => mapCandidateRow(row as CandidateRow)) };
  });
}

export async function syncApprovedProofsToBillingCandidates(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientBillingCandidate[]>> {
  return runService(async () => {
    const proofs = await listVisitProofs(tenantId, { status: ['approved', 'exported'] });
    if (!proofs.ok) return proofs;

    const visitIds = new Set<string>();
    const clientProofs: AssistVisitProofRow[] = [];
    for (const proof of proofs.data) {
      const visit = await fetchVisitForBilling(tenantId, proof.visitId);
      if (visit?.client_id === clientId) {
        clientProofs.push(proof);
        visitIds.add(proof.visitId);
      }
    }

    const results: ClientBillingCandidate[] = [];
    for (const proof of clientProofs) {
      const upserted = await upsertBillingCandidateFromProof(tenantId, proof);
      if (upserted.ok) results.push(upserted.data);
    }

    return { ok: true, data: results };
  });
}

export { neverFinalizeInvoice };
