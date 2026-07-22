import type { ServiceResult } from '@/types';
import type { EmployeePayrollPersonnelBundle } from '@/types/modules/employeePayrollPersonnel';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  buildPayrollPersonnelBundle,
  type EmployeeContractSettingsRow,
  type EmployeePayrollSettingsRow,
  type EmployeePayrollPersonalRow,
  type EmployeeSecondaryEmploymentRow,
  type EmployeeSocialInsuranceRow,
  type EmployeeTaxSettingsRow,
} from './employeePayrollPersonnelMapper';

const demoPayrollStore = new Map<string, EmployeePayrollPersonnelBundle>();

function storeKey(tenantId: string, employeeId: string): string {
  return `${tenantId}:${employeeId}`;
}

export function resetEmployeePayrollPersonnelDemoStore(): void {
  demoPayrollStore.clear();
}

export function seedEmployeePayrollPersonnelDemo(
  tenantId: string,
  employeeId: string,
  bundle: EmployeePayrollPersonnelBundle,
): void {
  demoPayrollStore.set(storeKey(tenantId, employeeId), bundle);
}

function defaultBundle(): EmployeePayrollPersonnelBundle {
  return buildPayrollPersonnelBundle({ employee: {} });
}

async function loadVacationDaysUsed(
  tenantId: string,
  employeeId: string,
  year: number,
): Promise<number | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year}-12-31T23:59:59.999Z`;

  const { data, error } = await fromUnknownTable(supabase, 'workforce_absences')
    .select('requested_days, absence_type, status, starts_at')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .eq('absence_type', 'vacation')
    .in('status', ['approved', 'active', 'completed'])
    .gte('starts_at', yearStart)
    .lte('starts_at', yearEnd);

  if (error) {
    if (isSupabaseMissingTableError(error)) return null;
    return null;
  }

  let total = 0;
  for (const row of data ?? []) {
    const days = (row as { requested_days?: number | null }).requested_days;
    if (typeof days === 'number' && Number.isFinite(days)) {
      total += days;
    } else {
      total += 1;
    }
  }
  return Math.round(total * 10) / 10;
}

export async function loadEmployeePayrollPersonnelBundle(
  tenantId: string,
  employeeId: string,
  employeeRow?: EmployeePayrollPersonalRow | null,
): Promise<ServiceResult<EmployeePayrollPersonnelBundle>> {
  if (getServiceMode() !== 'supabase') {
    return {
      ok: true,
      data: demoPayrollStore.get(storeKey(tenantId, employeeId)) ?? defaultBundle(),
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  let personalRow = employeeRow;
  if (!personalRow) {
    const { data, error } = await supabase
      .from('employees')
      .select('salutation, academic_title, nationality, address_supplement, entry_date')
      .eq('tenant_id', tenantId)
      .eq('id', employeeId)
      .maybeSingle();

    if (error && !isSupabaseMissingTableError(error)) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    personalRow = (data as EmployeePayrollPersonalRow | null) ?? {};
  }

  const year = new Date().getFullYear();
  const [contractRes, payrollRes, taxRes, socialRes, secondaryRes, vacationUsed] = await Promise.all([
    fromUnknownTable(supabase, 'employee_contract_settings')
      .select('job_title_key, education_degrees, work_days, work_on_holidays, annual_vacation_days')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .maybeSingle(),
    fromUnknownTable(supabase, 'employee_payroll_settings')
      .select(
        'compensation_type, compensation_amount, payout_interval, payout_method, iban, bank_name, account_holder, alternate_account_holder, max_payout_hours_month, overflow_to_time_account, mileage_rate_cents, payroll_notes',
      )
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .maybeSingle(),
    fromUnknownTable(supabase, 'employee_tax_settings')
      .select('tax_calculation_type, tax_id')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .maybeSingle(),
    fromUnknownTable(supabase, 'employee_social_insurance')
      .select(
        'insurance_type, health_insurance_key, pension_fund_registered, social_security_number, employer_relationship',
      )
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .maybeSingle(),
    fromUnknownTable(supabase, 'employee_secondary_employments')
      .select('id, tenant_id, employee_id, employer_name, gross_monthly_income, sort_order, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('sort_order', { ascending: true }),
    loadVacationDaysUsed(tenantId, employeeId, year),
  ]);

  const missingTable = [contractRes.error, payrollRes.error, taxRes.error, socialRes.error, secondaryRes.error].some(
    (err) => err && isSupabaseMissingTableError(err),
  );
  if (missingTable) {
    return { ok: true, data: buildPayrollPersonnelBundle({ employee: personalRow ?? {} }) };
  }

  return {
    ok: true,
    data: buildPayrollPersonnelBundle({
      employee: personalRow ?? {},
      contract: contractRes.data as EmployeeContractSettingsRow | null,
      payroll: payrollRes.data as EmployeePayrollSettingsRow | null,
      tax: taxRes.data as EmployeeTaxSettingsRow | null,
      socialInsurance: socialRes.data as EmployeeSocialInsuranceRow | null,
      secondaryEmployments: (secondaryRes.data ?? []) as EmployeeSecondaryEmploymentRow[],
      vacationDaysUsed: vacationUsed,
    }),
  };
}
