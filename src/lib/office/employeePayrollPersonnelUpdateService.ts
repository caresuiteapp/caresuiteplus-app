import type { RoleKey, ServiceResult } from '@/types';
import type {
  EmployeeContractSettings,
  EmployeePayrollPersonnelBundle,
  EmployeePayrollSettings,
  EmployeePersonalData,
  EmployeeSecondaryEmploymentRecord,
  EmployeeSocialInsuranceSettings,
  EmployeeTaxSettings,
} from '@/types/modules/employeePayrollPersonnel';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { appendEmployeeAuditEvent } from './employeePersonnelAuditService';
import {
  buildContractSettingsUpsertPayload,
  buildPayrollSettingsUpsertPayload,
  buildPersonalDataUpdatePayload,
  buildSocialInsuranceUpsertPayload,
  buildTaxSettingsUpsertPayload,
} from './employeePayrollPersonnelMapper';
import {
  loadEmployeePayrollPersonnelBundle,
  seedEmployeePayrollPersonnelDemo,
} from './employeePayrollPersonnelLoader';
import {
  validateEmployeeIban,
  validateSocialSecurityNumber,
  validateSteuerId,
  sumWorkDayHours,
} from './employeePayrollValidation';
import { syncEmployeePayrollToWfm } from './employeePayrollWfmSync';

async function mergeDemoBundle(
  tenantId: string,
  employeeId: string,
  merge: (current: EmployeePayrollPersonnelBundle) => EmployeePayrollPersonnelBundle,
): Promise<ServiceResult<EmployeePayrollPersonnelBundle>> {
  const current = await loadEmployeePayrollPersonnelBundle(tenantId, employeeId);
  if (!current.ok) return current;
  const next = merge(current.data);
  seedEmployeePayrollPersonnelDemo(tenantId, employeeId, next);
  return { ok: true, data: next };
}

export async function updateEmployeePersonalPayrollData(
  tenantId: string,
  employeeId: string,
  patch: Partial<EmployeePersonalData>,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<EmployeePayrollPersonnelBundle>> {
  const denied = enforcePermission(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const payload = buildPersonalDataUpdatePayload(patch);
  if (Object.keys(payload).length === 0) {
    return loadEmployeePayrollPersonnelBundle(tenantId, employeeId);
  }

  if (getServiceMode() !== 'supabase') {
    return mergeDemoBundle(tenantId, employeeId, (current) => ({
      ...current,
      personalData: { ...current.personalData, ...patch },
    }));
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { error } = await fromUnknownTable(supabase, 'employees')
    .update(payload)
    .eq('tenant_id', tenantId)
    .eq('id', employeeId);
  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  await appendEmployeeAuditEvent({
    tenantId,
    employeeId,
    action: 'payroll_personal_updated',
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: 'Persönliche Payroll-Stammdaten aktualisiert.',
  });

  return loadEmployeePayrollPersonnelBundle(tenantId, employeeId);
}

export async function updateEmployeeContractSettings(
  tenantId: string,
  employeeId: string,
  patch: Partial<EmployeeContractSettings>,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<EmployeePayrollPersonnelBundle>> {
  const denied = enforcePermission(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (patch.workDays) {
    const totalHours = sumWorkDayHours(patch.workDays);
    if (totalHours > 60) {
      return { ok: false, error: 'Summe der Tagesstunden darf 60 nicht überschreiten.' };
    }
  }

  if (getServiceMode() !== 'supabase') {
    const result = await mergeDemoBundle(tenantId, employeeId, (current) => ({
      ...current,
      contract: { ...current.contract, ...patch },
    }));
    if (result.ok && patch.workDays) {
      await syncEmployeePayrollToWfm(tenantId, employeeId, {
        weeklyHours: sumWorkDayHours(patch.workDays),
        annualVacationDays: patch.annualVacationDays ?? result.data.contract.annualVacationDays,
      });
    }
    return result;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const payload = buildContractSettingsUpsertPayload(tenantId, employeeId, patch);
  const { error } = await fromUnknownTable(supabase, 'employee_contract_settings').upsert(payload, {
    onConflict: 'tenant_id,employee_id',
  });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  if (patch.workDays) {
    const weeklyHours = sumWorkDayHours(patch.workDays);
    await fromUnknownTable(supabase, 'employees')
      .update({ weekly_hours: weeklyHours > 0 ? weeklyHours : null })
      .eq('tenant_id', tenantId)
      .eq('id', employeeId);
    await syncEmployeePayrollToWfm(tenantId, employeeId, {
      weeklyHours,
      annualVacationDays: patch.annualVacationDays ?? null,
    });
  }

  await appendEmployeeAuditEvent({
    tenantId,
    employeeId,
    action: 'contract_settings_updated',
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: 'Vertrags- und Urlaubsdaten aktualisiert.',
  });

  return loadEmployeePayrollPersonnelBundle(tenantId, employeeId);
}

export async function updateEmployeePayrollSettings(
  tenantId: string,
  employeeId: string,
  patch: Partial<EmployeePayrollSettings>,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<EmployeePayrollPersonnelBundle>> {
  const denied = enforcePermission(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (patch.iban) {
    const ibanError = validateEmployeeIban(patch.iban);
    if (ibanError) return { ok: false, error: ibanError };
  }

  if (getServiceMode() !== 'supabase') {
    return mergeDemoBundle(tenantId, employeeId, (current) => ({
      ...current,
      payroll: { ...current.payroll, ...patch },
    }));
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const payload = buildPayrollSettingsUpsertPayload(tenantId, employeeId, patch);
  const { error } = await fromUnknownTable(supabase, 'employee_payroll_settings').upsert(payload, {
    onConflict: 'tenant_id,employee_id',
  });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  await appendEmployeeAuditEvent({
    tenantId,
    employeeId,
    action: 'payroll_settings_updated',
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: 'Vergütungs- und Bankdaten aktualisiert.',
  });

  return loadEmployeePayrollPersonnelBundle(tenantId, employeeId);
}

export async function updateEmployeeTaxSettings(
  tenantId: string,
  employeeId: string,
  patch: Partial<EmployeeTaxSettings>,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<EmployeePayrollPersonnelBundle>> {
  const denied = enforcePermission(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (patch.taxId) {
    const taxError = validateSteuerId(patch.taxId);
    if (taxError) return { ok: false, error: taxError };
  }

  if (getServiceMode() !== 'supabase') {
    return mergeDemoBundle(tenantId, employeeId, (current) => ({
      ...current,
      tax: { ...current.tax, ...patch },
    }));
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const payload = buildTaxSettingsUpsertPayload(tenantId, employeeId, patch);
  const { error } = await fromUnknownTable(supabase, 'employee_tax_settings').upsert(payload, {
    onConflict: 'tenant_id,employee_id',
  });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  await appendEmployeeAuditEvent({
    tenantId,
    employeeId,
    action: 'tax_settings_updated',
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: 'Lohnsteuerdaten aktualisiert.',
  });

  return loadEmployeePayrollPersonnelBundle(tenantId, employeeId);
}

export async function updateEmployeeSocialInsuranceSettings(
  tenantId: string,
  employeeId: string,
  patch: Partial<EmployeeSocialInsuranceSettings>,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<EmployeePayrollPersonnelBundle>> {
  const denied = enforcePermission(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (patch.socialSecurityNumber) {
    const svError = validateSocialSecurityNumber(patch.socialSecurityNumber);
    if (svError) return { ok: false, error: svError };
  }

  if (getServiceMode() !== 'supabase') {
    return mergeDemoBundle(tenantId, employeeId, (current) => ({
      ...current,
      socialInsurance: { ...current.socialInsurance, ...patch },
    }));
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const payload = buildSocialInsuranceUpsertPayload(tenantId, employeeId, patch);
  const { error } = await fromUnknownTable(supabase, 'employee_social_insurance').upsert(payload, {
    onConflict: 'tenant_id,employee_id',
  });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  await appendEmployeeAuditEvent({
    tenantId,
    employeeId,
    action: 'social_insurance_updated',
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: 'Sozialversicherungsdaten aktualisiert.',
  });

  return loadEmployeePayrollPersonnelBundle(tenantId, employeeId);
}

export type SecondaryEmploymentInput = {
  id?: string;
  employerName: string;
  grossMonthlyIncome: number | null;
};

export async function replaceEmployeeSecondaryEmployments(
  tenantId: string,
  employeeId: string,
  rows: SecondaryEmploymentInput[],
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<EmployeePayrollPersonnelBundle>> {
  const denied = enforcePermission(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const normalized = rows
    .map((row, index) => ({
      employerName: row.employerName.trim(),
      grossMonthlyIncome: row.grossMonthlyIncome,
      sortOrder: index,
    }))
    .filter((row) => row.employerName.length > 0);

  if (getServiceMode() !== 'supabase') {
    const now = new Date().toISOString();
    return mergeDemoBundle(tenantId, employeeId, (current) => ({
      ...current,
      secondaryEmployments: normalized.map(
        (row, index): EmployeeSecondaryEmploymentRecord => ({
          id: `sec-${employeeId}-${index}`,
          tenantId,
          employeeId,
          employerName: row.employerName,
          grossMonthlyIncome: row.grossMonthlyIncome,
          sortOrder: row.sortOrder,
          createdAt: now,
          updatedAt: now,
        }),
      ),
    }));
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  await fromUnknownTable(supabase, 'employee_secondary_employments')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId);

  if (normalized.length > 0) {
    const insertRows = normalized.map((row) => ({
      tenant_id: tenantId,
      employee_id: employeeId,
      employer_name: row.employerName,
      gross_monthly_income: row.grossMonthlyIncome,
      sort_order: row.sortOrder,
    }));
    const { error } = await fromUnknownTable(supabase, 'employee_secondary_employments').insert(insertRows);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
  }

  await appendEmployeeAuditEvent({
    tenantId,
    employeeId,
    action: 'secondary_employments_updated',
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: 'Mehrfachbeschäftigungen aktualisiert.',
  });

  return loadEmployeePayrollPersonnelBundle(tenantId, employeeId);
}
