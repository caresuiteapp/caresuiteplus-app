import { getRequiredFieldsForClientContext, type ClientCareContext } from './clientIntakeFieldRules';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';

/** One plan for every selectable area. Combined selections use the union. */
export const CLIENT_INTAKE_PLANS: Record<ClientCareContext, { details: string; documents: string; required: string[] }> = {
  daily_assistance: { details: 'Haushalt, Einkaufen, gewünschte Tätigkeiten und Zeiten.', documents: 'Assist-Vertrag und Datenschutz; Vollmacht oder Schlüsselvereinbarung bei Bedarf.', required: ['supportWishes', 'serviceStart', 'billingTypes'] },
  support_care: { details: 'Beschäftigung, Tagesstruktur, Orientierung und Kommunikation.', documents: 'Assist-Vertrag und Datenschutz; ergänzende Einwilligungen nach Bedarf.', required: ['supportWishes', 'serviceStart', 'billingTypes'] },
  companionship: { details: 'Anlässe, Wege, Mobilität und gewünschte Begleitzeiten.', documents: 'Assist-Vertrag und Datenschutz; Vollmacht bei Bedarf.', required: ['supportWishes', 'serviceStart', 'billingTypes'] },
  ambulatory_care: { details: 'Pflegebedarf, Pflegegrad, Versicherung, Hausarzt und Wohnungszugang.', documents: 'Pflegevertrag und Datenschutz; Pflegegradbescheid, Medikationsplan und Verordnungen nach Bedarf.', required: ['serviceStart', 'billingTypes', 'careLevel', 'careFund', 'healthInsurance', 'insuranceNumber', 'familyDoctor', 'homeAccess'] },
  stationary_care: { details: 'Einrichtung, Wohnbereich, Zimmer, Einzug und Pflegegrad.', documents: 'Stationärer Vertrag und Datenschutz; Pflege- und Versorgungsunterlagen nach Bedarf.', required: ['serviceStart', 'facility', 'careArea', 'roomNumber', 'careLevel', 'careFund'] },
  consulting: { details: 'Beratungsart, Anlass, Beginn und nächste Schritte.', documents: 'Beratungsvertrag und Datenschutz; vorhandene Bescheide oder Vollmachten nach Bedarf.', required: ['consultingReason', 'consultingType', 'serviceStart'] },
  academy_prepared: { details: 'Interesse, Kontaktdaten und Schulungswunsch vormerken.', documents: 'Noch keine Schulungsverträge oder Schulungsfunktionen verfügbar. Als Erstkontakt oder Entwurf speichern.', required: [] },
};

export function getRequiredFieldsForIntake(form: ClientIntakeFormData): string[] {
  if (form.intakeWorkflowVersion !== 2) return getRequiredFieldsForClientContext(form.careContexts);
  const fields = new Set(['careContexts', 'firstName', 'lastName', 'dateOfBirth', 'street', 'zip', 'city', 'phoneOrContact']);
  for (const context of form.careContexts) for (const field of CLIENT_INTAKE_PLANS[context]?.required ?? []) fields.add(field);
  if (form.careContexts.some(context => context !== 'academy_prepared')) fields.add('fundingSources');
  return [...fields];
}

export function validateFirstContact(form: ClientIntakeFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.lastName.trim()) errors.lastName = 'Bitte mindestens den Nachnamen der interessierten Person angeben.';
  if (!form.phone.trim() && !form.mobile.trim() && !form.email.trim()) errors.phone = 'Bitte eine Telefonnummer oder E-Mail-Adresse angeben.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Bitte eine gültige E-Mail-Adresse angeben.';
  if (form.intakeAppointmentRequested) {
    const start = form.intakeAppointmentStart ?? '', end = form.intakeAppointmentEnd ?? '';
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)) errors.intakeAppointmentStart = 'Bitte Beginn mit Datum und Uhrzeit angeben.';
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(end) || end <= start) errors.intakeAppointmentEnd = 'Bitte ein Ende nach dem Beginn angeben.';
  }
  return errors;
}
