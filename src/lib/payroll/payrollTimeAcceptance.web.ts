import type { RoleKey, ServiceResult } from '@/types';
import type { PayrollTimeAcceptance, PayrollTimeAcceptanceOption } from '@/types/modules/payrollMonth';
import { getSupabaseClient } from '@/lib/supabase/client';
import { enforcePermission, isPortalOnlyRole } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { readStoredOfficeEntry, validateOfficeTimeValues } from '@/lib/wfm/wfmOfficeStoredEntry.web';
import { applyReviewToEntry, type WfmTimeEntryReview } from '@/lib/wfm/wfmTimeReviewService';
import type { PayrollTimeRegistry } from './payrollTimeDeferral.web';
import { acceptedPayrollTimeMatches, matchDeferredPayrollEntry, payrollPeriodNumber } from './payrollTimeDeferral.web';
import type { PayrollRow } from './payrollOfficeReadModel.web';

export function mapPayrollTimeAcceptance(row: PayrollRow): PayrollTimeAcceptance {
  const entry = readStoredOfficeEntry(row.office_entry, String(row.tenant_id), String(row.employee_id), String(row.work_date));
  if (!entry || !row.id || !row.deferred_key || !row.review_updated_at || !row.updated_at) throw new Error('Eine gespeicherte Zeitannahme ist unvollständig.');
  return { id: String(row.id), employeeId: String(row.employee_id), deferredKey: String(row.deferred_key),
    targetYear: Number(row.target_year), targetMonth: Number(row.target_month), reviewId: String(row.review_id),
    reviewUpdatedAt: String(row.review_updated_at), updatedAt: String(row.updated_at), entry };
}

export function payrollTimeAcceptanceOptions(input: {
  registry: PayrollTimeRegistry; reviews: WfmTimeEntryReview[]; acceptances: PayrollTimeAcceptance[];
  statements: PayrollRow[]; year: number; month: number; now: number;
}): PayrollTimeAcceptanceOption[] {
  const period = payrollPeriodNumber(input.year, input.month);
  const locked = (target: number) => input.statements.some(row => payrollPeriodNumber(Number(row.period_year), Number(row.period_month)) === target && ['confirmed', 'locked', 'paid'].includes(String(row.status)));
  return [...input.registry.deferred.values()].filter(item => !input.registry.settled.has(item.key)
    && payrollPeriodNumber(item.originYear, item.originMonth) <= period).map(item => {
    const matches = input.reviews.filter(review => review.officeEntry && matchDeferredPayrollEntry(item, [review.officeEntry]));
    const review = matches.length === 1 ? matches[0] : null;
    const entry = review?.officeEntry ? applyReviewToEntry(review.officeEntry, review) : null;
    const acceptance = input.acceptances.find(row => row.deferredKey === item.key) ?? null;
    const block = !entry || !review?.updatedAt ? 'Noch keine eindeutig zugeordnete Zeitkorrektur vorhanden.'
      : validateOfficeTimeValues(entry.actualStartAt, entry.actualEndAt, entry.pauseMinutes)
        || (Date.parse(entry.actualEndAt!) > input.now ? 'Die Zeit ist noch nicht abgeschlossen.' : null)
        || (['locked', 'superseded', 'rejected', 'needs_clarification'].includes(review.reviewStatus) || ['exported', 'changed_after_export'].includes(review.exportStatus ?? '') ? 'Die Zeit muss zuerst im Zeitkonto geklärt werden.' : null);
    const acceptedPeriod = acceptance && entry && acceptedPayrollTimeMatches(acceptance, entry) ? payrollPeriodNumber(acceptance.targetYear, acceptance.targetMonth) : null;
    const targetBlock = (target: number) => block || (locked(target) ? 'Die Abrechnung ist bestätigt, gesperrt oder ausgezahlt.' : null)
      || (acceptedPeriod === target ? 'Für diesen Monat bereits angenommen.' : null);
    return { item, entry, reviewId: review?.id ?? null, reviewUpdatedAt: review?.updatedAt ?? null, acceptance,
      currentBlock: targetBlock(period), nextBlock: targetBlock(period + 1) };
  }).sort((a, b) => b.item.workDate.localeCompare(a.item.workDate) || a.item.key.localeCompare(b.item.key));
}

export async function acceptPayrollTime(input: {
  tenantId: string; employeeId: string; option: PayrollTimeAcceptanceOption; year: number; month: number; role: RoleKey | null;
}): Promise<ServiceResult<PayrollTimeAcceptance>> {
  if (!input.role || isPortalOnlyRole(input.role)) return { ok: false, error: 'Für die Zeitannahme ist ein Verwaltungszugang erforderlich.' };
  for (const key of ['office.employees.view', 'office.employees.edit'] as const) { const denied = enforcePermission<PayrollTimeAcceptance>(input.role, key); if (denied) return denied; }
  const scope = guardServiceTenant(input.tenantId); if (scope) return scope;
  const db = getSupabaseClient();
  if (!db || getServiceMode() !== 'supabase') return { ok: false, error: 'Keine Verbindung zur Gehaltsstatistik.' };
  if (!input.option.reviewId || !input.option.reviewUpdatedAt) return { ok: false, error: 'Bitte die nachbearbeitete Zeit erneut laden.' };
  try {
    const rpc = db as unknown as { rpc: (name: string, args: PayrollRow) => Promise<{ data: PayrollRow | null; error: { message: string } | null }> };
    const result = await rpc.rpc('payroll_accept_corrected_time', { p_tenant_id: input.tenantId, p_employee_id: input.employeeId,
      p_deferred_key: input.option.item.key, p_review_id: input.option.reviewId, p_expected_review_updated_at: input.option.reviewUpdatedAt,
      p_target_year: input.year, p_target_month: input.month, p_expected_acceptance_updated_at: input.option.acceptance?.updatedAt ?? null });
    if (result.error) return { ok: false, error: result.error.message };
    if (!result.data || result.data.tenant_id !== input.tenantId || result.data.employee_id !== input.employeeId
      || result.data.deferred_key !== input.option.item.key || result.data.target_year !== input.year || result.data.target_month !== input.month) {
      return { ok: false, error: 'Der Server hat die Zeitannahme nicht eindeutig bestätigt. Bitte aktualisieren.' };
    }
    return { ok: true, data: mapPayrollTimeAcceptance(result.data) };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Die Zeitannahme ist fehlgeschlagen.' }; }
}
