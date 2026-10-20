import type { EmployeeMasterData } from '@/types/modules/employeePersonnelFile';

export type EmployeeMasterDataErrors = Partial<Record<keyof EmployeeMasterData, string>>;

export function hasEmployeeMasterDataErrors(errors: EmployeeMasterDataErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Prompt 66/71 — Stammdatenvalidierung für Personalakte */
export function validateEmployeeMasterData(
  data: EmployeeMasterData,
  tenantId?: string | null,
): EmployeeMasterDataErrors {
  const errors: EmployeeMasterDataErrors = {};

  if (tenantId !== undefined && !tenantId?.trim()) {
    errors.firstName = 'Kein Mitarbeitende:r ohne tenant_id.';
  }

  if (!data.firstName.trim()) errors.firstName = 'Vorname ist erforderlich.';
  if (!data.lastName.trim()) errors.lastName = 'Nachname ist erforderlich.';

  if (data.email?.trim() && !data.email.includes('@')) {
    errors.email = 'Gültige E-Mail erforderlich.';
  }

  if (data.weeklyHours != null && (data.weeklyHours < 0 || data.weeklyHours > 60)) {
    errors.weeklyHours = 'Wochenstunden zwischen 0 und 60.';
  }

  if (data.entryDate && data.exitDate) {
    if (new Date(data.exitDate) < new Date(data.entryDate)) {
      errors.exitDate = 'Austrittsdatum liegt vor Eintritt.';
    }
  }

  if (data.emergencyContactPhone?.trim() && !data.emergencyContactName?.trim()) {
    errors.emergencyContactName = 'Notfallkontakt-Name erforderlich.';
  }

  return errors;
}
