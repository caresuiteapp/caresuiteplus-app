import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type {
  ClientBudgetConsumptionEvent,
  ClientBudgetConsumptionEventKind,
  ClientBudgetEntitlementPeriod,
} from './clientBudgetEntitlementDomain';

export type ClientBudgetEntitlementLedger = {
  periods: ClientBudgetEntitlementPeriod[];
  events: ClientBudgetConsumptionEvent[];
};

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Ungültiges Feld: ${field}`);
  return value;
}

function nullableText(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return requiredText(value, field);
}

function cents(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Ungültiges Feld: ${field}`);
  return parsed;
}

export function mapClientBudgetEntitlementPeriodRow(row: Record<string, unknown>): ClientBudgetEntitlementPeriod {
  return {
    id: requiredText(row.id, 'id'),
    tenantId: requiredText(row.tenant_id, 'tenant_id'),
    clientId: requiredText(row.client_id, 'client_id'),
    financingPathId: requiredText(row.financing_path_id, 'financing_path_id'),
    serviceTypeKey: requiredText(row.service_type_key, 'service_type_key'),
    basisReference: requiredText(row.basis_reference, 'basis_reference'),
    periodStart: requiredText(row.period_start, 'period_start'),
    periodEnd: requiredText(row.period_end, 'period_end'),
    allocatedCents: cents(row.allocated_cents, 'allocated_cents'),
    createdAt: requiredText(row.created_at, 'created_at'),
  };
}

export function mapClientBudgetConsumptionEventRow(row: Record<string, unknown>): ClientBudgetConsumptionEvent {
  const eventKind = requiredText(row.event_kind, 'event_kind');
  if (!['usage', 'correction', 'cancellation'].includes(eventKind)) throw new Error('Unbekannte Verbrauchsereignisart.');
  return {
    id: requiredText(row.id, 'id'),
    tenantId: requiredText(row.tenant_id, 'tenant_id'),
    clientId: requiredText(row.client_id, 'client_id'),
    entitlementPeriodId: requiredText(row.entitlement_period_id, 'entitlement_period_id'),
    financingPathId: requiredText(row.financing_path_id, 'financing_path_id'),
    serviceTypeKey: requiredText(row.service_type_key, 'service_type_key'),
    serviceDate: requiredText(row.service_date, 'service_date'),
    amountCents: cents(row.amount_cents, 'amount_cents'),
    eventKind: eventKind as ClientBudgetConsumptionEventKind,
    supersedesEventId: nullableText(row.supersedes_event_id, 'supersedes_event_id'),
    sourceType: requiredText(row.source_type, 'source_type'),
    sourceId: requiredText(row.source_id, 'source_id'),
    reason: nullableText(row.reason, 'reason'),
    recordedAt: requiredText(row.recorded_at, 'recorded_at'),
  };
}

export async function listClientBudgetEntitlementLedger(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientBudgetEntitlementLedger>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const periodsResult = await fromUnknownTable(client, 'client_budget_entitlement_periods')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('period_start', { ascending: false })
      .order('id', { ascending: true });
    if (periodsResult.error) {
      if (isSupabaseMissingTableError(periodsResult.error)) return { ok: true, data: { periods: [], events: [] }, tableMissing: true };
      return { ok: false, error: toGermanSupabaseError(periodsResult.error) };
    }

    const eventsResult = await fromUnknownTable(client, 'client_budget_consumption_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('recorded_at', { ascending: true })
      .order('id', { ascending: true });
    if (eventsResult.error) {
      if (isSupabaseMissingTableError(eventsResult.error)) return { ok: true, data: { periods: [], events: [] }, tableMissing: true };
      return { ok: false, error: toGermanSupabaseError(eventsResult.error) };
    }

    try {
      const periods = (periodsResult.data ?? []).map((row) => mapClientBudgetEntitlementPeriodRow(row as Record<string, unknown>));
      const events = (eventsResult.data ?? []).map((row) => mapClientBudgetConsumptionEventRow(row as Record<string, unknown>));
      if (periods.some((row) => row.tenantId !== tenantId || row.clientId !== clientId)
        || events.some((row) => row.tenantId !== tenantId || row.clientId !== clientId)) {
        return { ok: false, error: 'Budgetnachweise konnten nicht mandanten- und falltreu gelesen werden.' };
      }
      return { ok: true, data: { periods, events } };
    } catch {
      return { ok: false, error: 'Budgetnachweise enthalten unvollständige oder unbekannte Originaldaten.' };
    }
  });
}
