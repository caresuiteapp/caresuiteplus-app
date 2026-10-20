/**
 * Sync Pflegegrad from legacy sources into client_care_entitlement (Migration 0175/0177).
 */
import type { ServiceResult } from '@/types';
import type { ClientCareEntitlement, ClientCareGrade } from '@/types/assist/clientAssistBilling';
import { isConversionEligibleForGrade } from '@/types/assist/clientAssistBilling';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { mapCareEntitlementRow } from './clientAssistBillingMappers';
import { ensureClientBudgetAccountsForDate } from './clientBudgetAccountService';

type LegacyCareSource = {
  careGrade: ClientCareGrade;
  validFrom: string;
  validUntil: string | null;
  conversionEnabled: boolean;
  careFundName: string | null;
  careFundMemberId: string | null;
  mdAssessmentDate: string | null;
  notes: string | null;
  source: string;
};

const CARE_INSURANCE_INTRODUCTION_DATE = '1995-01-01';

/** Rejects birth dates, impossible pre-insurance dates and future dates as care-grade start dates. */
export function normalizeLegacyCareGradeValidFrom(
  value: unknown,
  dateOfBirth?: string | null,
  today = new Date().toISOString().slice(0, 10),
): string {
  const candidate = typeof value === 'string' ? value.slice(0, 10) : '';
  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(candidate);
  if (
    !isIsoDate
    || candidate < CARE_INSURANCE_INTRODUCTION_DATE
    || candidate > today
    || (!!dateOfBirth && candidate === dateOfBirth.slice(0, 10))
  ) {
    return today;
  }
  return candidate;
}

/** Map legacy grade strings (client_care_levels, clients.care_level, intake) to entitlement keys. */
export function mapLegacyGradeToEntitlement(
  grade: string | null | undefined,
): ClientCareGrade | null {
  if (!grade) return null;
  const normalized = grade.trim().toLowerCase().replace(/\s+/g, '');
  const alias: Record<string, ClientCareGrade> = {
    none: 'kein',
    unknown: 'kein',
    kein: 'kein',
    unbekannt: 'kein',
    pg1: 'pg1',
    pg2: 'pg2',
    pg3: 'pg3',
    pg4: 'pg4',
    pg5: 'pg5',
    hospiz: 'hospiz',
  };
  if (alias[normalized]) return alias[normalized];
  const pgMatch = normalized.match(/^pg([1-5])$/);
  if (pgMatch) return `pg${pgMatch[1]}` as ClientCareGrade;
  return null;
}

export function shouldUpsertEntitlement(
  current: ClientCareEntitlement | null,
  next: LegacyCareSource,
): boolean {
  if (!current) return true;
  return (
    current.careGrade !== next.careGrade
    || current.validFrom !== next.validFrom
    || current.careFundMemberId !== next.careFundMemberId
    || current.careFundName !== next.careFundName
  );
}

async function resolveLegacyCareLevelSource(
  tenantId: string,
  clientId: string,
): Promise<LegacyCareSource | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data: clientRow } = await client
    .from('clients')
    .select('care_level, insurance_name, insurance_number, date_of_birth')
    .eq('tenant_id', tenantId)
    .eq('id', clientId)
    .maybeSingle();
  const dateOfBirth = clientRow?.date_of_birth ? String(clientRow.date_of_birth) : null;

  const { data: careLevels } = await fromUnknownTable(client, 'client_care_levels')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .order('valid_from', { ascending: false })
    .limit(1);

  const latestLevel = (careLevels ?? [])[0] as Record<string, unknown> | undefined;
  if (latestLevel) {
    const grade = mapLegacyGradeToEntitlement(String(latestLevel.grade ?? ''));
    if (grade) {
      return {
        careGrade: grade,
        validFrom: normalizeLegacyCareGradeValidFrom(latestLevel.valid_from, dateOfBirth),
        validUntil: latestLevel.valid_until ? String(latestLevel.valid_until) : null,
        conversionEnabled: isConversionEligibleForGrade(grade),
        careFundName: latestLevel.care_fund_name ? String(latestLevel.care_fund_name) : null,
        careFundMemberId: latestLevel.care_fund_member_id ? String(latestLevel.care_fund_member_id) : null,
        mdAssessmentDate: latestLevel.md_assessment_date ? String(latestLevel.md_assessment_date) : null,
        notes: latestLevel.notes ? String(latestLevel.notes) : null,
        source: 'client_care_levels',
      };
    }
  }

  if (clientRow?.care_level) {
    const grade = mapLegacyGradeToEntitlement(String(clientRow.care_level));
    if (grade) {
      return {
        careGrade: grade,
        validFrom: normalizeLegacyCareGradeValidFrom(null, dateOfBirth),
        validUntil: null,
        conversionEnabled: isConversionEligibleForGrade(grade),
        careFundName: clientRow.insurance_name ? String(clientRow.insurance_name) : null,
        careFundMemberId: clientRow.insurance_number ? String(clientRow.insurance_number) : null,
        mdAssessmentDate: null,
        notes: null,
        source: 'clients.care_level',
      };
    }
  }

  const { data: insurance } = await fromUnknownTable(client, 'client_insurance_profiles')
    .select('care_level, care_level_valid_from, care_fund_name, insurance_number')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('is_primary', true)
    .maybeSingle();

  if (insurance) {
    const row = insurance as Record<string, unknown>;
    const grade = mapLegacyGradeToEntitlement(String(row.care_level ?? ''));
    if (grade) {
      return {
        careGrade: grade,
        validFrom: normalizeLegacyCareGradeValidFrom(row.care_level_valid_from, dateOfBirth),
        validUntil: null,
        conversionEnabled: isConversionEligibleForGrade(grade),
        careFundName: row.care_fund_name ? String(row.care_fund_name) : null,
        careFundMemberId: row.insurance_number ? String(row.insurance_number) : null,
        mdAssessmentDate: null,
        notes: null,
        source: 'client_insurance_profiles',
      };
    }
  }

  return null;
}

async function writeEntitlementAudit(
  tenantId: string,
  clientId: string,
  action: string,
  entityId: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await fromUnknownTable(client, 'client_billing_audit_log').insert({
    tenant_id: tenantId,
    client_id: clientId,
    action,
    entity_type: 'client_care_entitlement',
    entity_id: entityId,
    payload,
  });
}

export async function syncClientCareEntitlementFromLegacy(
  tenantId: string,
  clientId: string,
  options: { regenerateAccounts?: boolean } = {},
): Promise<ServiceResult<ClientCareEntitlement | null>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const legacy = await resolveLegacyCareLevelSource(tenantId, clientId);
    if (!legacy) return { ok: true, data: null };

    const { data: existingRows, error: loadError } = await fromUnknownTable(client, 'client_care_entitlement')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .is('valid_until', null)
      .order('valid_from', { ascending: false })
      .limit(1);

    if (loadError) {
      if (isSupabaseMissingTableError(loadError)) {
        return { ok: false, error: 'Pflegegrad-Anspruch-Tabelle fehlt — Migration 0175 anwenden.' };
      }
      return { ok: false, error: toGermanSupabaseError(loadError) };
    }

    const current = existingRows?.[0]
      ? mapCareEntitlementRow(existingRows[0] as Record<string, unknown>)
      : null;

    if (!shouldUpsertEntitlement(current, legacy)) {
      if (options.regenerateAccounts) {
        await ensureClientBudgetAccountsForDate(tenantId, clientId, legacy.careGrade);
      }
      return { ok: true, data: current };
    }

    if (current) {
      const closeDate = new Date(`${legacy.validFrom}T12:00:00.000Z`);
      closeDate.setDate(closeDate.getDate() - 1);
      await fromUnknownTable(client, 'client_care_entitlement')
        .update({ valid_until: closeDate.toISOString().slice(0, 10) })
        .eq('id', current.id);
    }

    const { data: inserted, error: insertError } = await fromUnknownTable(client, 'client_care_entitlement')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        care_grade: legacy.careGrade,
        valid_from: legacy.validFrom,
        valid_until: legacy.validUntil,
        conversion_enabled: legacy.conversionEnabled,
        care_fund_name: legacy.careFundName,
        care_fund_member_id: legacy.careFundMemberId,
        md_assessment_date: legacy.mdAssessmentDate,
        notes: legacy.notes,
        source: legacy.source,
        metadata: { synced_at: new Date().toISOString() },
      })
      .select('*')
      .single();

    if (insertError) return { ok: false, error: toGermanSupabaseError(insertError) };

    const entitlement = mapCareEntitlementRow(inserted as Record<string, unknown>);
    await writeEntitlementAudit(tenantId, clientId, 'sync_from_legacy', entitlement.id, {
      previousGrade: current?.careGrade ?? null,
      nextGrade: legacy.careGrade,
      source: legacy.source,
    });

    if (options.regenerateAccounts !== false) {
      await ensureClientBudgetAccountsForDate(tenantId, clientId, legacy.careGrade);
    }

    return { ok: true, data: entitlement };
  });
}

export async function backfillClientCareEntitlementsForTenant(
  tenantId: string,
): Promise<ServiceResult<{ synced: number; skipped: number }>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data: clients, error } = await client
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId);

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    let synced = 0;
    let skipped = 0;

    for (const row of clients ?? []) {
      const result = await syncClientCareEntitlementFromLegacy(
        tenantId,
        (row as { id: string }).id,
        { regenerateAccounts: true },
      );
      if (result.ok && result.data) synced += 1;
      else skipped += 1;
    }

    return { ok: true, data: { synced, skipped } };
  });
}
