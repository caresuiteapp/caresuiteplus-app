import type { ClientFormData, ClientFormErrors } from '@/types/forms/clientForm';

export function validateClientProductionStep(
  step: number,
  data: ClientFormData,
): ClientFormErrors {
  const errors: ClientFormErrors = {};

  if (step === 0) {
    if (!data.firstName.trim()) errors.firstName = 'Vorname ist erforderlich.';
    if (!data.lastName.trim()) errors.lastName = 'Nachname ist erforderlich.';
    if (data.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(data.dateOfBirth)) {
      errors.dateOfBirth = 'Format: JJJJ-MM-TT';
    }
  }

  if (step === 1) {
    if (!data.zip.trim()) errors.zip = 'PLZ ist erforderlich.';
    if (!data.city.trim()) errors.city = 'Ort ist erforderlich.';
    if (data.email && !data.email.includes('@')) {
      errors.email = 'Ungültige E-Mail-Adresse.';
    }
  }

  return errors;
}

export function validateClientProductionForm(data: ClientFormData): ClientFormErrors {
  return {
    ...validateClientProductionStep(0, data),
    ...validateClientProductionStep(1, data),
  };
}

export function hasProductionErrors(errors: ClientFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
