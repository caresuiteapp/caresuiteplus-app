import type {
  EmployeeCompensationType,
  EmployeeContractSettings,
  EmployeeInsuranceType,
  EmployeePayrollPersonnelBundle,
  EmployeePayrollSettings,
  EmployeePayoutInterval,
  EmployeePayoutMethod,
  EmployeePersonalData,
  EmployeeSalutation,
  EmployeeSecondaryEmploymentRecord,
  EmployeeSocialInsuranceSettings,
  EmployeeTaxSettings,
  EmployeeWorkDayKey,
  EmployeeWorkDaySchedule,
} from '@/types/modules/employeePayrollPersonnel';
import { DEFAULT_WORK_DAY_SCHEDULE as DEFAULT_SCHEDULE } from '@/types/modules/employeePayrollPersonnel';
import {
  calculateProRatedVacationDays,
  deriveBankNameFromIban,
} from './employeePayrollValidation';

export type EmployeePayrollPersonalRow = {
  salutation?: string | null;
  academic_title?: string | null;
  nationality?: string | null;
  address_supplement?: string | null;
  entry_date?: string | null;
};

export type EmployeeContractSettingsRow = {
  job_title_key?: string | null;
  education_degrees?: unknown;
  work_days?: unknown;
  work_on_holidays?: boolean | null;
  annual_vacation_days?: number | null;
};

export type EmployeePayrollSettingsRow = {
  compensation_type?: string | null;
  compensation_amount?: number | null;
  payout_interval?: string | null;
  payout_method?: string | null;
  iban?: string | null;
  bank_name?: string | null;
  account_holder?: string | null;
  alternate_account_holder?: string | null;
  max_payout_hours_month?: number | null;
  overflow_to_time_account?: boolean | null;
  mileage_rate_cents?: number | null;
  payroll_notes?: string | null;
};

export type EmployeeTaxSettingsRow = {
  tax_calculation_type?: string | null;
  tax_id?: string | null;
};

export type EmployeeSocialInsuranceRow = {
  insurance_type?: string | null;
  health_insurance_key?: string | null;
  pension_fund_registered?: boolean | null;
  social_security_number?: string | null;
  employer_relationship?: boolean | null;
};

export type EmployeeSecondaryEmploymentRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  employer_name: string;
  gross_monthly_income?: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const WORK_DAY_KEYS: EmployeeWorkDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function parseWorkDaySchedule(raw: unknown): EmployeeWorkDaySchedule {
  const schedule = { ...DEFAULT_SCHEDULE };
  if (!raw || typeof raw !== 'object') return schedule;
  for (const key of WORK_DAY_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      schedule[key] = value;
    }
  }
  return schedule;
}

function parseEducationDegrees(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function mapPersonalDataRow(row: EmployeePayrollPersonalRow | null | undefined): EmployeePersonalData {
  const salutation = row?.salutation?.trim();
  const validSalutation =
    salutation === 'herr' || salutation === 'frau' || salutation === 'divers' ? salutation : null;
  return {
    salutation: validSalutation as EmployeeSalutation | null,
    academicTitle: row?.academic_title?.trim() || null,
    nationality: row?.nationality?.trim() || 'DE',
    addressSupplement: row?.address_supplement?.trim() || null,
  };
}

export function mapContractSettingsRow(
  row: EmployeeContractSettingsRow | null | undefined,
  entryDate: string | null,
  vacationDaysUsed: number | null,
): EmployeeContractSettings {
  const annualVacationDays = row?.annual_vacation_days ?? null;
  return {
    jobTitleKey: row?.job_title_key?.trim() || null,
    educationDegrees: parseEducationDegrees(row?.education_degrees),
    workDays: parseWorkDaySchedule(row?.work_days),
    workOnHolidays: row?.work_on_holidays === true,
    annualVacationDays,
    calculatedVacationDays: calculateProRatedVacationDays(annualVacationDays, entryDate),
    vacationDaysUsed,
  };
}

export function mapPayrollSettingsRow(
  row: EmployeePayrollSettingsRow | null | undefined,
): EmployeePayrollSettings {
  const iban = row?.iban?.trim() || null;
  const compensationType =
    row?.compensation_type === 'hourly' ? 'hourly' : ('salary' as EmployeeCompensationType);
  const payoutInterval = (['monthly', 'weekly', 'biweekly'] as const).includes(
    row?.payout_interval as EmployeePayoutInterval,
  )
    ? (row?.payout_interval as EmployeePayoutInterval)
    : 'monthly';
  const payoutMethod =
    row?.payout_method === 'cash' ? 'cash' : ('transfer' as EmployeePayoutMethod);

  return {
    compensationType,
    compensationAmount: row?.compensation_amount ?? null,
    payoutInterval,
    payoutMethod,
    iban,
    bankName: row?.bank_name?.trim() || deriveBankNameFromIban(iban),
    accountHolder: row?.account_holder?.trim() || null,
    alternateAccountHolder: row?.alternate_account_holder?.trim() || null,
    maxPayoutHoursMonth: row?.max_payout_hours_month ?? null,
    overflowToTimeAccount: row?.overflow_to_time_account !== false,
    mileageRateCents: row?.mileage_rate_cents ?? 30,
    payrollNotes: row?.payroll_notes?.trim() || null,
  };
}

export function mapTaxSettingsRow(row: EmployeeTaxSettingsRow | null | undefined): EmployeeTaxSettings {
  return {
    taxCalculationType: row?.tax_calculation_type?.trim() || null,
    taxId: row?.tax_id?.trim() || null,
  };
}

export function mapSocialInsuranceRow(
  row: EmployeeSocialInsuranceRow | null | undefined,
): EmployeeSocialInsuranceSettings {
  return {
    insuranceType:
      row?.insurance_type === 'private' ? 'private' : ('statutory' as EmployeeInsuranceType),
    healthInsuranceKey: row?.health_insurance_key?.trim() || null,
    pensionFundRegistered: row?.pension_fund_registered === true,
    socialSecurityNumber: row?.social_security_number?.trim() || null,
    employerRelationship: row?.employer_relationship === true,
  };
}

export function mapSecondaryEmploymentRow(
  row: EmployeeSecondaryEmploymentRow,
): EmployeeSecondaryEmploymentRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    employerName: row.employer_name?.trim() || '',
    grossMonthlyIncome: row.gross_monthly_income ?? null,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildPayrollPersonnelBundle(input: {
  employee: EmployeePayrollPersonalRow;
  contract?: EmployeeContractSettingsRow | null;
  payroll?: EmployeePayrollSettingsRow | null;
  tax?: EmployeeTaxSettingsRow | null;
  socialInsurance?: EmployeeSocialInsuranceRow | null;
  secondaryEmployments?: EmployeeSecondaryEmploymentRow[];
  vacationDaysUsed?: number | null;
}): EmployeePayrollPersonnelBundle {
  return {
    personalData: mapPersonalDataRow(input.employee),
    contract: mapContractSettingsRow(
      input.contract,
      input.employee.entry_date ?? null,
      input.vacationDaysUsed ?? null,
    ),
    payroll: mapPayrollSettingsRow(input.payroll),
    tax: mapTaxSettingsRow(input.tax),
    socialInsurance: mapSocialInsuranceRow(input.socialInsurance),
    secondaryEmployments: (input.secondaryEmployments ?? []).map(mapSecondaryEmploymentRow),
  };
}

export function buildPersonalDataUpdatePayload(patch: Partial<EmployeePersonalData>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (patch.salutation !== undefined) payload.salutation = patch.salutation;
  if (patch.academicTitle !== undefined) payload.academic_title = patch.academicTitle?.trim() || null;
  if (patch.nationality !== undefined) payload.nationality = patch.nationality?.trim() || 'DE';
  if (patch.addressSupplement !== undefined) {
    payload.address_supplement = patch.addressSupplement?.trim() || null;
  }
  return payload;
}

export function buildContractSettingsUpsertPayload(
  tenantId: string,
  employeeId: string,
  patch: Partial<EmployeeContractSettings>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { tenant_id: tenantId, employee_id: employeeId };
  if (patch.jobTitleKey !== undefined) payload.job_title_key = patch.jobTitleKey?.trim() || null;
  if (patch.educationDegrees !== undefined) payload.education_degrees = patch.educationDegrees;
  if (patch.workDays !== undefined) payload.work_days = patch.workDays;
  if (patch.workOnHolidays !== undefined) payload.work_on_holidays = patch.workOnHolidays;
  if (patch.annualVacationDays !== undefined) payload.annual_vacation_days = patch.annualVacationDays;
  return payload;
}

export function buildPayrollSettingsUpsertPayload(
  tenantId: string,
  employeeId: string,
  patch: Partial<EmployeePayrollSettings>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { tenant_id: tenantId, employee_id: employeeId };
  if (patch.compensationType !== undefined) payload.compensation_type = patch.compensationType;
  if (patch.compensationAmount !== undefined) payload.compensation_amount = patch.compensationAmount;
  if (patch.payoutInterval !== undefined) payload.payout_interval = patch.payoutInterval;
  if (patch.payoutMethod !== undefined) payload.payout_method = patch.payoutMethod;
  if (patch.iban !== undefined) {
    payload.iban = patch.iban?.replace(/\s/g, '').toUpperCase() || null;
    if (patch.bankName === undefined) {
      payload.bank_name = deriveBankNameFromIban(patch.iban) ?? null;
    }
  }
  if (patch.bankName !== undefined) payload.bank_name = patch.bankName?.trim() || null;
  if (patch.accountHolder !== undefined) payload.account_holder = patch.accountHolder?.trim() || null;
  if (patch.alternateAccountHolder !== undefined) {
    payload.alternate_account_holder = patch.alternateAccountHolder?.trim() || null;
  }
  if (patch.maxPayoutHoursMonth !== undefined) payload.max_payout_hours_month = patch.maxPayoutHoursMonth;
  if (patch.overflowToTimeAccount !== undefined) payload.overflow_to_time_account = patch.overflowToTimeAccount;
  if (patch.mileageRateCents !== undefined) payload.mileage_rate_cents = patch.mileageRateCents;
  if (patch.payrollNotes !== undefined) payload.payroll_notes = patch.payrollNotes?.trim() || null;
  return payload;
}

export function buildTaxSettingsUpsertPayload(
  tenantId: string,
  employeeId: string,
  patch: Partial<EmployeeTaxSettings>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { tenant_id: tenantId, employee_id: employeeId };
  if (patch.taxCalculationType !== undefined) {
    payload.tax_calculation_type = patch.taxCalculationType?.trim() || null;
  }
  if (patch.taxId !== undefined) payload.tax_id = patch.taxId?.replace(/\s/g, '') || null;
  return payload;
}

export function buildSocialInsuranceUpsertPayload(
  tenantId: string,
  employeeId: string,
  patch: Partial<EmployeeSocialInsuranceSettings>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { tenant_id: tenantId, employee_id: employeeId };
  if (patch.insuranceType !== undefined) payload.insurance_type = patch.insuranceType;
  if (patch.healthInsuranceKey !== undefined) {
    payload.health_insurance_key = patch.healthInsuranceKey?.trim() || null;
  }
  if (patch.pensionFundRegistered !== undefined) {
    payload.pension_fund_registered = patch.pensionFundRegistered;
  }
  if (patch.socialSecurityNumber !== undefined) {
    payload.social_security_number =
      patch.socialSecurityNumber?.replace(/\s/g, '').toUpperCase() || null;
  }
  if (patch.employerRelationship !== undefined) {
    payload.employer_relationship = patch.employerRelationship;
  }
  return payload;
}
