import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export type EmployeePayrollWfmSyncInput = {
  weeklyHours: number | null;
  annualVacationDays?: number | null;
};

/** Synchronisiert Wochenstunden in WFM-Zeitkonten-Metadaten (best effort). */
export async function syncEmployeePayrollToWfm(
  tenantId: string,
  employeeId: string,
  input: EmployeePayrollWfmSyncInput,
): Promise<void> {
  if (getServiceMode() !== 'supabase') return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const weeklyHours = input.weeklyHours ?? 0;
  const targetMinutes = weeklyHours > 0 ? Math.round(weeklyHours * 60 * 4.33) : 0;

  const metadata = {
    weekly_hours: weeklyHours,
    annual_vacation_days: input.annualVacationDays ?? null,
    synced_from: 'employee_contract_settings',
    synced_at: now.toISOString(),
  };

  const { error } = await fromUnknownTable(supabase, 'workforce_time_accounts').upsert(
    {
      tenant_id: tenantId,
      employee_id: employeeId,
      period_year: year,
      period_month: month,
      target_minutes: targetMinutes,
      metadata,
    },
    { onConflict: 'tenant_id,employee_id,period_year,period_month' },
  );

  if (error && !isSupabaseMissingTableError(error)) {
    return;
  }
}
