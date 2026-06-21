/**
 * K.5 — billing readiness and blocking reasons (no final invoices).
 */
import type { ServiceResult } from '@/types';
import type {
  BillingBlockingReasonKey,
  BillingCandidateStatus,
  BillingReadinessSummary,
  ClientBillingCandidate,
  ProofBillingSourceSnapshot,
  TenantBillingSettings,
  TenantServiceTypeBillingRule,
} from '@/types/clientBilling';
import type { ClientBudgetSetting } from '@/types/clientCore';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { listClientBudgetSettings } from '@/lib/client/clientBudgetSettingsService';
import { listClientServiceProfiles } from '@/lib/client/clientServiceTypeService';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getProofBillingSourceSnapshot, validateProofForBilling } from './clientProofBillingMapper';

export function neverFinalizeInvoice(): { allowed: false; reason: string } {
  return {
    allowed: false,
    reason:
      'K.5 erlaubt keine finale Rechnungserzeugung. Bitte K.6 oder manuelle Freigabe abwarten.',
  };
}

export function getBillingBlockingReasons(input: {
  source: ProofBillingSourceSnapshot;
  proof?: AssistVisitProofRow | null;
  budgetSettings?: ClientBudgetSetting[];
  serviceProfileActive?: boolean;
  billingRule?: TenantServiceTypeBillingRule | null;
  tenantSettings?: TenantBillingSettings | null;
  amountPreviewCents?: number;
  hasCostCarrier?: boolean;
  hasAssignmentDeclaration?: boolean;
}): BillingBlockingReasonKey[] {
  const reasons: BillingBlockingReasonKey[] = [];
  const {
    source,
    budgetSettings = [],
    serviceProfileActive = true,
    billingRule,
    tenantSettings,
    amountPreviewCents = 0,
    hasCostCarrier = false,
    hasAssignmentDeclaration = false,
  } = input;

  if (!source.clientId) reasons.push('missing_client');
  if (!source.serviceTypeKey && !input.proof) reasons.push('missing_service_type');
  if (!serviceProfileActive) reasons.push('service_profile_inactive');

  const requireApproval = billingRule?.requireApproval ?? tenantSettings?.requireApproval ?? true;
  const requireSignature = billingRule?.requireSignature ?? tenantSettings?.requireSignature ?? true;
  const requireBudget = billingRule?.requireBudget ?? true;
  const requireAssignment =
    billingRule?.requireAssignmentDeclaration ??
    tenantSettings?.requireAssignmentDeclaration ??
    false;

  if (requireApproval && !source.approved) reasons.push('proof_not_approved');
  if (requireSignature && !source.signed) reasons.push('missing_signature');
  if (source.portalReleaseStatus === 'revoked') reasons.push('portal_release_revoked');

  if (!source.startTime || !source.endTime || (source.durationMinutes ?? 0) <= 0) {
    reasons.push('invalid_time_range');
  }

  if (requireBudget && budgetSettings.length === 0) reasons.push('missing_budget_setting');
  if (budgetSettings.some((s) => (s.remainingCents ?? 0) < 0)) {
    const allowOverrun =
      billingRule?.allowBudgetOverrun ?? tenantSettings?.allowBudgetOverrun ?? false;
    if (!allowOverrun) reasons.push('budget_exceeded');
  }

  const rateConfigured = billingRule?.defaultRateAmount != null && billingRule.defaultRateAmount > 0;
  if (!rateConfigured && amountPreviewCents <= 0) reasons.push('missing_rate');
  if (amountPreviewCents <= 0) reasons.push('amount_zero');

  const target = billingRule?.defaultBillingTargetType ?? 'cost_carrier';
  if (target === 'cost_carrier' && !hasCostCarrier) reasons.push('missing_cost_carrier');
  if (requireAssignment && !hasAssignmentDeclaration) reasons.push('missing_assignment_declaration');
  if (target === 'internal') reasons.push('billing_target_unknown');

  return [...new Set(reasons)];
}

export function isProofReadyForBilling(
  proof: AssistVisitProofRow,
  source: ProofBillingSourceSnapshot,
  blockingReasons: BillingBlockingReasonKey[],
): boolean {
  const base = validateProofForBilling(proof);
  if (!base.ok) return false;
  const hardBlock = blockingReasons.filter(
    (r) => r !== 'missing_cost_carrier' && r !== 'missing_assignment_declaration',
  );
  return hardBlock.length === 0 && source.approved;
}

export function isCandidateDraftable(
  candidate: Pick<ClientBillingCandidate, 'status' | 'blockingReasons' | 'amountPreviewCents'>,
): boolean {
  if (candidate.amountPreviewCents <= 0) return false;
  const blockers = candidate.blockingReasons.filter(
    (r) =>
      r !== 'missing_cost_carrier' &&
      r !== 'missing_assignment_declaration' &&
      r !== 'proof_not_released',
  );
  return blockers.length === 0;
}

export function resolveCandidateStatus(
  blockingReasons: BillingBlockingReasonKey[],
  amountPreviewCents: number,
): BillingCandidateStatus {
  if (amountPreviewCents <= 0) return 'not_ready';
  const hardBlock = blockingReasons.filter(
    (r) =>
      r !== 'missing_cost_carrier' &&
      r !== 'missing_assignment_declaration' &&
      r !== 'proof_not_released',
  );
  if (hardBlock.length > 0) return 'blocked';
  const softBlock = blockingReasons.filter(
    (r) => r === 'missing_cost_carrier' || r === 'missing_assignment_declaration',
  );
  if (softBlock.length > 0) return 'ready_for_review';
  return 'draftable';
}

export function isClientReadyForBilling(
  summary: BillingReadinessSummary,
): boolean {
  return summary.draftableCount > 0 && summary.hasBudgetSettings;
}

export async function getBillingReadinessSummaryForClient(
  tenantId: string,
  clientId: string,
  candidates: ClientBillingCandidate[],
): Promise<ServiceResult<BillingReadinessSummary>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const budgets = await listClientBudgetSettings(tenantId, clientId);
    if (!budgets.ok) return budgets;

    const allReasons = new Set<BillingBlockingReasonKey>();
    for (const c of candidates) {
      for (const r of c.blockingReasons) allReasons.add(r);
    }

    return {
      ok: true,
      data: {
        clientId,
        totalCandidates: candidates.length,
        draftableCount: candidates.filter((c) => c.status === 'draftable').length,
        blockedCount: candidates.filter((c) => c.status === 'blocked').length,
        readyForReviewCount: candidates.filter((c) => c.status === 'ready_for_review').length,
        blockingReasons: [...allReasons],
        hasBudgetSettings: budgets.data.length > 0,
        hasBillingRules: true,
      },
    };
  });
}

export { SERVICE_ERRORS };
