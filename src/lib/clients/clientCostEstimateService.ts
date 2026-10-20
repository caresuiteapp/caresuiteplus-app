import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type { ClientCostEstimateDecision, ClientCostEstimateLine, ClientCostEstimateStatus, ClientCostEstimateVersion } from './clientCostEstimateDomain';

export type ClientCostEstimateLedger = { estimates: ClientCostEstimateVersion[]; lines: ClientCostEstimateLine[]; decisions: ClientCostEstimateDecision[] };
const required = (value: unknown, field: string) => { if (typeof value !== 'string' || !value.trim()) throw new Error(`Ungültiges Feld: ${field}`); return value; };
const nullable = (value: unknown, field: string) => value === null || value === undefined ? null : required(value, field);
const integer = (value: unknown, field: string) => { const parsed = Number(value); if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Ungültiges Feld: ${field}`); return parsed; };

export function mapClientCostEstimateRow(row: Record<string, unknown>): ClientCostEstimateVersion {
  const status = required(row.status, 'status');
  if (!['draft', 'issued', 'superseded', 'withdrawn'].includes(status)) throw new Error('Unbekannter Angebotsstatus.');
  if (row.currency !== 'EUR') throw new Error('Unbekannte Angebotswährung.');
  return { id: required(row.id, 'id'), logicalEstimateId: required(row.logical_estimate_id, 'logical_estimate_id'), tenantId: required(row.tenant_id, 'tenant_id'), clientId: required(row.client_id, 'client_id'), financingPathId: required(row.financing_path_id, 'financing_path_id'), version: integer(row.version, 'version'), status: status as ClientCostEstimateStatus, issueDate: required(row.issue_date, 'issue_date'), validUntil: required(row.valid_until, 'valid_until'), servicePeriodStart: required(row.service_period_start, 'service_period_start'), servicePeriodEnd: required(row.service_period_end, 'service_period_end'), payerContributionCents: integer(row.payer_contribution_cents, 'payer_contribution_cents'), selfPayCents: integer(row.self_pay_cents, 'self_pay_cents'), currency: 'EUR', contentFingerprint: required(row.content_fingerprint, 'content_fingerprint'), supersedesEstimateId: nullable(row.supersedes_estimate_id, 'supersedes_estimate_id'), createdAt: required(row.created_at, 'created_at') };
}

export function mapClientCostEstimateLineRow(row: Record<string, unknown>): ClientCostEstimateLine {
  const unit = required(row.frequency_unit, 'frequency_unit');
  if (!['once', 'week', 'month', 'period'].includes(unit)) throw new Error('Unbekannte Häufigkeitseinheit.');
  return { id: required(row.id, 'id'), tenantId: required(row.tenant_id, 'tenant_id'), clientId: required(row.client_id, 'client_id'), financingPathId: required(row.financing_path_id, 'financing_path_id'), estimateVersionId: required(row.estimate_version_id, 'estimate_version_id'), tariffPositionId: required(row.tariff_position_id, 'tariff_position_id'), serviceCode: required(row.service_code, 'service_code'), serviceLabel: required(row.service_label, 'service_label'), billingUnit: required(row.billing_unit, 'billing_unit'), normalizedQuantity: required(row.normalized_quantity, 'normalized_quantity'), frequencyCount: integer(row.frequency_count, 'frequency_count'), frequencyUnit: unit as ClientCostEstimateLine['frequencyUnit'], occurrenceAmountCents: integer(row.occurrence_amount_cents, 'occurrence_amount_cents'), totalAmountCents: integer(row.total_amount_cents, 'total_amount_cents') };
}

export function mapClientCostEstimateDecisionRow(row: Record<string, unknown>): ClientCostEstimateDecision {
  const decision = required(row.decision, 'decision');
  if (!['accepted', 'declined'].includes(decision)) throw new Error('Unbekannte Angebotsentscheidung.');
  return { id: required(row.id, 'id'), tenantId: required(row.tenant_id, 'tenant_id'), clientId: required(row.client_id, 'client_id'), financingPathId: required(row.financing_path_id, 'financing_path_id'), estimateVersionId: required(row.estimate_version_id, 'estimate_version_id'), logicalEstimateId: required(row.logical_estimate_id, 'logical_estimate_id'), estimateVersion: integer(row.estimate_version, 'estimate_version'), contentFingerprint: required(row.content_fingerprint, 'content_fingerprint'), decision: decision as ClientCostEstimateDecision['decision'], decidedAt: required(row.decided_at, 'decided_at'), decidedByName: required(row.decided_by_name, 'decided_by_name'), decidedByRole: required(row.decided_by_role, 'decided_by_role'), evidenceReference: required(row.evidence_reference, 'evidence_reference') };
}

export async function listClientCostEstimateLedger(tenantId: string, clientId: string): Promise<ServiceResult<ClientCostEstimateLedger>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId); if (denied) return denied;
    const client = getSupabaseClient(); if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
    const tables = ['client_cost_estimates', 'client_cost_estimate_lines', 'client_cost_estimate_decisions'] as const;
    const results = [];
    for (const table of tables) {
      const result = await fromUnknownTable(client, table).select('*').eq('tenant_id', tenantId).eq('client_id', clientId).order(table === 'client_cost_estimate_decisions' ? 'decided_at' : 'created_at', { ascending: true });
      if (result.error) {
        if (isSupabaseMissingTableError(result.error)) return { ok: true, data: { estimates: [], lines: [], decisions: [] }, tableMissing: true };
        return { ok: false, error: toGermanSupabaseError(result.error) };
      }
      results.push(result.data ?? []);
    }
    try {
      const estimates = results[0].map((row) => mapClientCostEstimateRow(row as Record<string, unknown>));
      const lines = results[1].map((row) => mapClientCostEstimateLineRow(row as Record<string, unknown>));
      const decisions = results[2].map((row) => mapClientCostEstimateDecisionRow(row as Record<string, unknown>));
      if ([...estimates, ...lines, ...decisions].some((row) => row.tenantId !== tenantId || row.clientId !== clientId)) return { ok: false, error: 'Kostenvoranschläge konnten nicht mandanten- und falltreu gelesen werden.' };
      return { ok: true, data: { estimates, lines, decisions } };
    } catch { return { ok: false, error: 'Kostenvoranschläge enthalten unvollständige oder unbekannte Originaldaten.' }; }
  });
}
