import type { ClientFormData, ClientFormErrors } from '@/types/forms/clientForm';

export function validateClientFormStep(
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
    if (!data.street.trim()) errors.street = 'Straße ist erforderlich.';
    if (!data.zip.trim()) errors.zip = 'PLZ ist erforderlich.';
    if (!data.city.trim()) errors.city = 'Ort ist erforderlich.';
    if (data.email && !data.email.includes('@')) {
      errors.email = 'Ungültige E-Mail-Adresse.';
    }
  }

  if (step === 2) {
    if (!data.careLevel.trim()) errors.careLevel = 'Pflegegrad ist erforderlich.';
    if (!data.careFundName.trim()) errors.careFundName = 'Pflegekasse ist erforderlich.';
    if (!data.billingType) errors.billingType = 'Abrechnungsart ist erforderlich.';
    if (!data.contractStart.trim()) errors.contractStart = 'Vertragsbeginn ist erforderlich.';
    if (!data.serviceType) errors.serviceType = 'Leistungsart ist erforderlich.';
    if (!data.hourlyRate.trim() || Number.isNaN(Number(data.hourlyRate))) {
      errors.hourlyRate = 'Gültiger Stundensatz erforderlich.';
    }
  }

  if (step === 3) {
    if (!data.emergencyContactName.trim()) {
      errors.emergencyContactName = 'Notfallkontakt ist erforderlich.';
    }
    if (!data.emergencyContactPhone.trim()) {
      errors.emergencyContactPhone = 'Notfall-Telefon ist erforderlich.';
    }
    if (data.taskCategories.length === 0) {
      errors.taskCategories = 'Mindestens eine Aufgabenkategorie wählen.';
    }
  }

  if (step === 4) {
    if (!data.consentDatenschutz) {
      errors.consentDatenschutz = 'Datenschutz-Einwilligung ist erforderlich.';
    }
    if (!data.consentVertrag) {
      errors.consentVertrag = 'Vertrags-Einwilligung ist erforderlich.';
    }
  }

  return errors;
}

export function hasErrors(errors: ClientFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
