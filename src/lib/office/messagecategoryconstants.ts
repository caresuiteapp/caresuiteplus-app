/** Emergency disclaimer shown when selecting Notfall-related categories (spec). */
export const PORTAL_EMERGENCY_DISCLAIMER =
  'Bei akuten Notfällen wenden Sie sich bitte sofort an den Notruf 112 oder Ihre Einrichtung telefonisch. ' +
  'Dieser Chat ersetzt keinen Notruf.';

export const CLIENT_CATEGORY_KEYS = [
  'cancel_assignment',
  'extra_assignment',
  'reschedule_appointment',
  'complaint',
  'billing_question',
  'documents_contract',
  'personal_data_change',
  'contact_person',
  'emergency_contact',
  'general_question',
  'feedback',
  'other',
] as const;

export const EMPLOYEE_CATEGORY_KEYS = [
  'assignment_problem',
  'client_not_met',
  'schedule_change',
  'sick_leave',
  'schedule_question',
  'documentation_problem',
  'app_software_problem',
  'service_proof',
  'travel_logbook',
  'billing_question',
  'materials',
  'general_question',
  'other',
] as const;

export function categoryShowsEmergencyDisclaimer(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata) return false;
  return metadata.emergency === true || metadata.show_disclaimer === true;
}

export function parseCategoryMetadata(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}
