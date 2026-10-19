import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type {
  ClientTariffBillingUnit,
  ClientTariffPosition,
  ClientTariffRoundingRule,
} from '@/lib/clients/clientTariffPositionDomain';

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Ungültiges Feld: ${field}`);
  return value;
}

function nullableText(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return text(value, field);
}

function nullableInteger(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error(`Ungültiges Feld: ${field}`);
  return result;
}

export function mapClientTariffPositionRow(row: Record<string, unknown>): ClientTariffPosition {
  const unit = text(row.billing_unit, 'billing_unit');
  if (!['minute', 'hour', 'visit', 'flat', 'unit', 'km'].includes(unit)) throw new Error('Unbekannte Tarifeinheit.');
  const price = Number(row.unit_price_cents);
  const version = Number(row.version);
  if (!Number.isSafeInteger(price) || price <= 0) throw new Error('Ungültiger Tarifpreis.');
  if (!Number.isInteger(version) || version < 1) throw new Error('Ungültige Tarifversion.');
  if (row.currency !== 'EUR') throw new Error('Unbekannte Tarifwährung.');
  if (typeof row.is_open_ended !== 'boolean') throw new Error('Ungültige Laufzeitkennzeichnung.');
  const roundingRule = nullableText(row.rounding_rule, 'rounding_rule');
  if (roundingRule !== null && !['half_up_cent', 'ceil_cent', 'floor_cent'].includes(roundingRule)) {
    throw new Error('Unbekannte Rundungsregel.');
  }
  const surchargeBasisPoints = nullableInteger(row.surcharge_basis_points, 'surcharge_basis_points');
  const fixedSurchargeCents = nullableInteger(row.fixed_surcharge_cents, 'fixed_surcharge_cents');
  if (surchargeBasisPoints !== null && (surchargeBasisPoints < 0 || surchargeBasisPoints > 10000)) {
    throw new Error('Ungültiger prozentualer Zuschlag.');
  }
  if (fixedSurchargeCents !== null && fixedSurchargeCents < 0) throw new Error('Ungültiger Festzuschlag.');
  return {
    id: text(row.id, 'id'),
    logicalPositionId: text(row.logical_position_id, 'logical_position_id'),
    tenantId: text(row.tenant_id, 'tenant_id'),
    clientId: text(row.client_id, 'client_id'),
    financingPathId: text(row.financing_path_id, 'financing_path_id'),
    regionCode: text(row.region_code, 'region_code'),
    regionName: text(row.region_name, 'region_name'),
    payerAssignmentId: nullableText(row.payer_assignment_id, 'payer_assignment_id'),
    payerName: text(row.payer_name, 'payer_name'),
    payerIk: nullableText(row.payer_ik, 'payer_ik'),
    serviceCode: text(row.service_code, 'service_code'),
    serviceLabel: text(row.service_label, 'service_label'),
    billingUnit: unit as ClientTariffBillingUnit,
    unitPriceCents: price,
    currency: 'EUR',
    roundingRule: roundingRule as ClientTariffRoundingRule | null,
    surchargeBasisPoints,
    fixedSurchargeCents,
    validFrom: text(row.valid_from, 'valid_from'),
    validUntil: nullableText(row.valid_until, 'valid_until'),
    openEnded: row.is_open_ended,
    agreementReference: text(row.agreement_reference, 'agreement_reference'),
    version,
    supersedesPositionId: nullableText(row.supersedes_position_id, 'supersedes_position_id'),
    createdAt: text(row.created_at, 'created_at'),
  };
}

export async function listClientTariffPositions(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientTariffPosition[]>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
    const { data, error } = await fromUnknownTable(client, 'client_tariff_positions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('valid_from', { ascending: false })
      .order('id', { ascending: true });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    try {
      const positions = (Array.isArray(data) ? data : []).map((row) => mapClientTariffPositionRow(row as Record<string, unknown>));
      if (positions.some((position) => position.tenantId !== tenantId || position.clientId !== clientId)) {
        return { ok: false, error: 'Tarifpositionen konnten nicht mandanten- und falltreu gelesen werden.' };
      }
      return { ok: true, data: positions };
    } catch {
      return { ok: false, error: 'Tarifpositionen enthalten unvollständige oder unbekannte Originaldaten.' };
    }
  });
}
