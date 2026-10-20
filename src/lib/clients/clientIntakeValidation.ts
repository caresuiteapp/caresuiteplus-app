import { getRequiredFieldsForClientContext, type IntakeSectionKey } from './clientIntakeFieldRules';
import type { ClientIntakeErrors, ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { COST_BEARER_FIELD_ERRORS, getCostBearerFieldValues, hasGkvCostBearerSelected, isCostBearerTypeKey } from './clientIntakeCostBearerConfig';
import { validateCostBearerEntry } from '@/features/costCarriers/costCarrierValidation';
import { listApplicableIntakeTemplates } from '@/features/intakeDocuments/buildIntakeDocumentContext';
import { validateIntakeDocumentsStep } from '@/features/intakeDocuments/validateIntakeDocuments';
import { parseGermanOrIsoDateInput } from '@/lib/formatters/dateTimeFormatters';

export function validateIntakeStep(
  section: IntakeSectionKey,
  form: ClientIntakeFormData,
): ClientIntakeErrors {
  const errors: ClientIntakeErrors = {};
  const required = getRequiredFieldsForClientContext(form.careContexts);
  const checkDate = (field: 'dateOfBirth' | 'serviceStart' | 'admissionDate' | 'careLevelValidFrom') => {
    const value = form[field].trim();
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !parseGermanOrIsoDateInput(value))) {
      errors[field] = 'Bitte ein gültiges Datum eingeben.';
    }
  };

  if (section === 'leistungsart') {
    if (form.careContexts.length === 0) {
      errors.careContexts = 'Mindestens eine Leistungsart auswählen.';
    }
  }

  if (section === 'stammdaten') {
    if (!form.firstName.trim()) errors.firstName = 'Vorname ist erforderlich.';
    if (!form.lastName.trim()) errors.lastName = 'Nachname ist erforderlich.';
    if (!form.dateOfBirth.trim()) errors.dateOfBirth = 'Geburtsdatum ist erforderlich.';
    if (required.includes('serviceStart') && !form.serviceStart.trim()) errors.serviceStart = 'Leistungsbeginn ist erforderlich.';
    checkDate('dateOfBirth');
    checkDate('serviceStart');
    checkDate('admissionDate');
    if (!errors.dateOfBirth && form.dateOfBirth && form.dateOfBirth > new Date().toISOString().slice(0, 10)) {
      errors.dateOfBirth = 'Das Geburtsdatum darf nicht in der Zukunft liegen.';
    }
  }

  if (section === 'adresse_kontakt') {
    if (!form.street.trim()) errors.street = 'Straße ist erforderlich.';
    if (!form.zip.trim()) errors.zip = 'PLZ ist erforderlich.';
    if (!form.city.trim()) errors.city = 'Ort ist erforderlich.';
    if (form.zip.trim() && !/^\d{5}$/.test(form.zip.trim())) errors.zip = 'Bitte eine fünfstellige PLZ eingeben.';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Bitte eine gültige E-Mail-Adresse eingeben.';
    }
    if (!form.phone.trim() && !form.mobile.trim() && !form.email.trim()) {
      errors.phone = 'Telefon, Mobil oder E-Mail erforderlich.';
    }
  }

  if (section === 'kostentraeger') {
    checkDate('careLevelValidFrom');
    if (form.fundingSources.length === 0) {
      errors.fundingSources = 'Mindestens eine Finanzierungsart auswählen.';
    }
    if (required.includes('billingTypes') && form.billingTypes.length === 0) {
      errors.billingTypes = 'Abrechnungsart ist erforderlich.';
    }
    if (required.includes('careLevel') && !form.careLevel) {
      errors.careLevel = 'Pflegegrad ist erforderlich.';
    }

    for (const type of form.costBearerTypes) {
      if (!isCostBearerTypeKey(type)) continue;
      const values = getCostBearerFieldValues(form, type);
      const entryError = validateCostBearerEntry(type, values);
      if (entryError) {
        errors[COST_BEARER_FIELD_ERRORS[type]] = entryError;
      }
    }

    if (required.includes('careFund') && form.costBearerTypes.includes('pflegekasse')) {
      const name = getCostBearerFieldValues(form, 'pflegekasse').name.trim();
      if (!name) errors.careFundName = 'Pflegekasse ist erforderlich.';
    }
    if (required.includes('healthInsurance') && form.costBearerTypes.includes('krankenkasse')) {
      const name = getCostBearerFieldValues(form, 'krankenkasse').name.trim();
      if (!name) errors.healthInsurance = 'Krankenkasse ist erforderlich.';
    }
    if (required.includes('insuranceNumber') && hasGkvCostBearerSelected(form.costBearerTypes) && !form.insuranceNumber.trim()) {
      errors.insuranceNumber = 'Versichertennummer ist erforderlich.';
    }
  }

  if (section === 'notfall_zugang') {
    if (required.includes('emergencyContact')) {
      if (!form.emergencyContactName.trim()) errors.emergencyContactName = 'Notfallkontakt erforderlich.';
      if (!form.emergencyContactPhone.trim()) errors.emergencyContactPhone = 'Notfall-Telefon erforderlich.';
    }
    if (required.includes('homeAccess') && form.homeAccess.length === 0) {
      errors.homeAccess = 'Wohnungszugang ist erforderlich.';
    }
    if (required.includes('facility') && !form.facilityName.trim()) {
      errors.facilityName = 'Einrichtung ist erforderlich.';
    }
    if (required.includes('roomNumber') && !form.roomNumber.trim()) {
      errors.roomNumber = 'Zimmernummer ist erforderlich.';
    }
    if (required.includes('careArea') && !form.careArea.trim()) {
      errors.careArea = 'Wohnbereich ist erforderlich.';
    }
  }

  if (section === 'versorgung') {
    if (required.includes('consultingReason') && !form.consultingReason.trim()) {
      errors.consultingReason = 'Beratungsanlass ist erforderlich.';
    }
    if (required.includes('consultingType') && !form.consultingType) {
      errors.consultingType = 'Beratungsart ist erforderlich.';
    }
    if (required.includes('familyDoctor') && !form.familyDoctor.trim()) {
      errors.familyDoctor = 'Hausarzt ist erforderlich.';
    }
    if (required.includes('supportWishes') && form.supportWishes.length === 0) {
      errors.supportWishes = 'Gewünschte Unterstützung auswählen.';
    }
  }

  if (section === 'vertraege_einwilligungen') {
    const templates = listApplicableIntakeTemplates(form);
    const docValidation = validateIntakeDocumentsStep(form, templates);
    Object.assign(errors, docValidation.errors);
  }

  return errors;
}

export function hasIntakeErrors(errors: ClientIntakeErrors): boolean {
  return Object.keys(errors).length > 0;
}

