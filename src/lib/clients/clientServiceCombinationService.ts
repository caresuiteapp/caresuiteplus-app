import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import type {
  ClientServiceCombinationOutcome,
  ClientServiceCombinationReview,
  ClientServiceCombinationRule,
} from './clientServiceCombinationDomain';

export type ClientServiceCombinationLedger = {
  rules: ClientServiceCombinationRule[];
  reviews: ClientServiceCombinationReview[];
};

function required(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Ungültiges Feld: ${field}`);
  return value;
}

function nullable(value: unknown, field: string): string | null {
  return value === null || value === undefined ? null : required(value, field);
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`Ungültiges Feld: ${field}`);
  return parsed;
}

function financingKind(value: unknown): ClientServiceCombinationRule['financingKind'] {
  const parsed = required(value, 'financing_kind');
  if (!['sgb_xi', 'sgb_v', 'private', 'other'].includes(parsed)) throw new Error('Unbekannte Finanzierungsart.');
  return parsed as ClientServiceCombinationRule['financingKind'];
}

function outcome(value: unknown): ClientServiceCombinationOutcome {
  const parsed = required(value, 'outcome');
  if (!['allowed', 'prohibited', 'surcharge_required'].includes(parsed)) throw new Error('Unbekanntes Prüfergebnis.');
  return parsed as ClientServiceCombinationOutcome;
}

export function mapClientServiceCombinationRuleRow(row: Record<string, unknown>): ClientServiceCombinationRule {
  return {
    id: required(row.id, 'id'), logicalRuleId: required(row.logical_rule_id, 'logical_rule_id'),
    tenantId: required(row.tenant_id, 'tenant_id'), version: positiveInteger(row.version, 'version'),
    financingKind: financingKind(row.financing_kind), costCarrierReference: required(row.cost_carrier_reference, 'cost_carrier_reference'),
    serviceTypeA: required(row.service_type_a, 'service_type_a'), serviceTypeB: required(row.service_type_b, 'service_type_b'),
    outcome: outcome(row.outcome), surchargeServiceType: nullable(row.surcharge_service_type, 'surcharge_service_type'),
    validFrom: required(row.valid_from, 'valid_from'), validUntil: nullable(row.valid_until, 'valid_until'),
    predecessorRuleId: nullable(row.predecessor_rule_id, 'predecessor_rule_id'),
    ruleTitle: required(row.rule_title, 'rule_title'), ruleReference: required(row.rule_reference, 'rule_reference'),
    contentFingerprint: required(row.content_fingerprint, 'content_fingerprint'), recordedAt: required(row.recorded_at, 'recorded_at'),
  };
}

export function mapClientServiceCombinationReviewRow(row: Record<string, unknown>): ClientServiceCombinationReview {
  return {
    id: required(row.id, 'id'), tenantId: required(row.tenant_id, 'tenant_id'), clientId: required(row.client_id, 'client_id'),
    financingPathId: required(row.financing_path_id, 'financing_path_id'), financingKind: financingKind(row.financing_kind),
    costCarrierReference: required(row.cost_carrier_reference, 'cost_carrier_reference'),
    serviceTypeA: required(row.service_type_a, 'service_type_a'), serviceTypeB: required(row.service_type_b, 'service_type_b'),
    serviceOn: required(row.service_on, 'service_on'), ruleId: required(row.rule_id, 'rule_id'),
    logicalRuleId: required(row.logical_rule_id, 'logical_rule_id'), ruleVersion: positiveInteger(row.rule_version, 'rule_version'),
    ruleFingerprint: required(row.rule_fingerprint, 'rule_fingerprint'), outcome: outcome(row.outcome),
    surchargeServiceType: nullable(row.surcharge_service_type, 'surcharge_service_type'),
    evidenceReference: required(row.evidence_reference, 'evidence_reference'), evaluatedAt: required(row.evaluated_at, 'evaluated_at'),
  };
}

export async function listClientServiceCombinationLedger(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientServiceCombinationLedger>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
    const ruleResult = await fromUnknownTable(client, 'client_service_combination_rules')
      .select('*').eq('tenant_id', tenantId).order('recorded_at', { ascending: true });
    if (ruleResult.error) {
      if (isSupabaseMissingTableError(ruleResult.error)) return { ok: true, data: { rules: [], reviews: [] }, tableMissing: true };
      return { ok: false, error: toGermanSupabaseError(ruleResult.error) };
    }
    const reviewResult = await fromUnknownTable(client, 'client_service_combination_reviews')
      .select('*').eq('tenant_id', tenantId).eq('client_id', clientId).order('evaluated_at', { ascending: false });
    if (reviewResult.error) {
      if (isSupabaseMissingTableError(reviewResult.error)) return { ok: true, data: { rules: [], reviews: [] }, tableMissing: true };
      return { ok: false, error: toGermanSupabaseError(reviewResult.error) };
    }
    try {
      const rules = (ruleResult.data ?? []).map((row) => mapClientServiceCombinationRuleRow(row as Record<string, unknown>));
      const reviews = (reviewResult.data ?? []).map((row) => mapClientServiceCombinationReviewRow(row as Record<string, unknown>));
      if (rules.some((rule) => rule.tenantId !== tenantId)
        || reviews.some((review) => review.tenantId !== tenantId || review.clientId !== clientId)) {
        return { ok: false, error: 'Leistungskombinationsprüfung konnte nicht mandanten- und falltreu gelesen werden.' };
      }
      return { ok: true, data: { rules, reviews } };
    } catch {
      return { ok: false, error: 'Leistungskombinationsprüfung enthält unvollständige oder unbekannte Originaldaten.' };
    }
  });
}
