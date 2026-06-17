import type { EmployeeEditFormData, EmployeeEditFormErrors } from '@/types/forms/employeeEditForm';

export function hasEmployeeEditErrors(errors: EmployeeEditFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function validateEmployeeEditStep(
  step: number,
  form: EmployeeEditFormData,
): EmployeeEditFormErrors {
  const errors: EmployeeEditFormErrors = {};

  if (step === 0 || step >= 3) {
    if (!form.firstName.trim()) errors.firstName = 'Vorname erforderlich';
    if (!form.lastName.trim()) errors.lastName = 'Nachname erforderlich';
    if (form.email.trim() && !form.email.includes('@')) {
      errors.email = 'Gültige E-Mail erforderlich';
    }
    if (!form.roleKey.trim()) errors.roleKey = 'Rolle erforderlich';
  }

  if (step === 1 || step >= 3) {
    if (form.weeklyHours.trim()) {
      const parsed = Number(form.weeklyHours.replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 60) {
        errors.weeklyHours = 'Wochenstunden zwischen 0 und 60';
      }
    }
  }

  return errors;
}
