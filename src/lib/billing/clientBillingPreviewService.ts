/**
 * K.5 — billing preview aggregation (no final invoices).
 */
import type { ServiceResult } from '@/types';
import type { ClientBillingPreview, ClientBillingPreviewLine } from '@/types/clientBilling';
import { listTenantClientServiceTypes } from '@/lib/client/clientServiceTypeService';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import {
  getBillingCandidatesForClient,
  syncApprovedProofsToBillingCandidates,
} from './clientBillingCandidateService';
import { getClientBudgetConsumptionSummary } from './clientBudgetConsumptionService';
import { getBillingReadinessSummaryForClient, neverFinalizeInvoice } from './clientBillingReadinessService';
import { BILLING_BLOCKING_REASON_LABELS } from '@/types/clientBilling';

function filterByPeriod(
  lines: ClientBillingPreviewLine[],
  periodStart?: string | null,
  periodEnd?: string | null,
): ClientBillingPreviewLine[] {
  if (!periodStart && !periodEnd) return lines;
  const startMs = periodStart ? new Date(periodStart).getTime() : null;
  const endMs = periodEnd ? new Date(periodEnd).getTime() : null;

  return lines.filter((line) => {
    if (!line.proofDate) return true;
    const d = new Date(line.proofDate).getTime();
    if (startMs != null && d < startMs) return false;
    if (endMs != null && d > endMs) return false;
    return true;
  });
}

export async function getClientBillingPreview(
  tenantId: string,
  clientId: string,
  options: { refresh?: boolean; periodStart?: string; periodEnd?: string; budgetYear?: number } = {},
): Promise<ServiceResult<ClientBillingPreview>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const guard = neverFinalizeInvoice();
    const warnings: string[] = [guard.reason];

    if (options.refresh) {
      await syncApprovedProofsToBillingCandidates(tenantId, clientId);
    }

    const [candidates, types, budgetSummary] = await Promise.all([
      getBillingCandidatesForClient(tenantId, clientId),
      listTenantClientServiceTypes(tenantId),
      getClientBudgetConsumptionSummary(tenantId, clientId, options.budgetYear ?? 2026),
    ]);

    if (!candidates.ok) return candidates;

    const typeMap = new Map(
      types.ok ? types.data.map((t) => [t.id, t.name]) : [],
    );

    const lines: ClientBillingPreviewLine[] = candidates.data.map((c) => ({
      candidateId: c.id,
      proofId: c.proofId,
      visitId: c.visitId,
      proofDate: c.proofDate,
      serviceTypeName: c.serviceTypeId ? typeMap.get(c.serviceTypeId) ?? null : null,
      durationMinutes: c.durationMinutes,
      amountPreviewCents: c.amountPreviewCents,
      status: c.status,
      blockingReasons: c.blockingReasons,
      billingTargetType: c.billingTargetType,
    }));

    const filtered = filterByPeriod(lines, options.periodStart, options.periodEnd);
    const allReasons = new Set(filtered.flatMap((l) => l.blockingReasons));

    for (const reason of allReasons) {
      warnings.push(BILLING_BLOCKING_REASON_LABELS[reason]);
    }

    if (budgetSummary.ok && budgetSummary.data.totalRemainingCents <= 0) {
      warnings.push('Verfügbares Budget aufgebraucht oder überschritten.');
    }

    const readiness = await getBillingReadinessSummaryForClient(tenantId, clientId, candidates.data);

    return {
      ok: true,
      data: {
        clientId,
        periodStart: options.periodStart ?? null,
        periodEnd: options.periodEnd ?? null,
        lines: filtered,
        totalAmountPreviewCents: filtered.reduce((s, l) => s + l.amountPreviewCents, 0),
        totalDurationMinutes: filtered.reduce((s, l) => s + (l.durationMinutes ?? 0), 0),
        draftableCount: filtered.filter((l) => l.status === 'draftable').length,
        blockedCount: filtered.filter((l) => l.status === 'blocked').length,
        blockingReasons: [...allReasons],
        budgetSummary: budgetSummary.ok ? budgetSummary.data : null,
        warnings,
        ...(readiness.ok ? {} : {}),
      },
    };
  });
}

export async function getBillingPreviewForPeriod(
  tenantId: string,
  clientId: string,
  periodStart: string,
  periodEnd: string,
): Promise<ServiceResult<ClientBillingPreview>> {
  return getClientBillingPreview(tenantId, clientId, { periodStart, periodEnd, refresh: true });
}

export { neverFinalizeInvoice };
