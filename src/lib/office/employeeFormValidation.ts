import type { EmployeeFormData, EmployeeFormErrors } from '@/types/forms/employeeForm';

export function hasEmployeeErrors(errors: EmployeeFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function validateEmployeeForm(form: EmployeeFormData): EmployeeFormErrors {
  const errors: EmployeeFormErrors = {};
  if (!form.firstName.trim()) errors.firstName = 'Vorname erforderlich';
  if (!form.lastName.trim()) errors.lastName = 'Nachname erforderlich';
  if (!form.email.trim() || !form.email.includes('@')) errors.email = 'Gültige E-Mail erforderlich';
  if (!form.jobTitle.trim()) errors.jobTitle = 'Rolle/Titel erforderlich';
  return errors;
}
