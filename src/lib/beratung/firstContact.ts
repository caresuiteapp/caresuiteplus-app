import { EMPTY_CLIENT_INTAKE_FORM, type ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { validateFirstContact } from '@/lib/clients/clientIntakePlan';
import type { ConsultationClient } from './workspaceModel';

export const emptyConsultationContact = () => ({
  firstName: '', lastName: '', phone: '', mobile: '', email: '',
  street: '', houseNumber: '', zip: '', city: '', dateOfBirth: '', careLevel: '',
  intakeContactPerson: '', intakeContactNotes: '', accessNotes: '',
});
export type ConsultationContactInput = ReturnType<typeof emptyConsultationContact>;
export type ConsultationContactAttempt = { clientId: string; operationId: string; form: ClientIntakeFormData };
export type ConsultationContactDraft = {
  input: ConsultationContactInput;
  clientId: string;
  pending?: ConsultationContactAttempt;
};

/** Uses the central intake contract; saving this draft never completes admission. */
export function consultationContactForm(input: ConsultationContactInput): ClientIntakeFormData {
  const clean = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value.trim()]));
  return { ...structuredClone(EMPTY_CLIENT_INTAKE_FORM), ...clean,
    intakeWorkflowVersion: 2, intakeStage: 'first_contact',
    intakeAppointmentRequested: false, careContexts: ['consulting'], assignedModules: ['office', 'beratung'],
    admissionDate: '', consultingReason: input.intakeContactNotes.trim(),
  };
}

export function consultationContactErrors(input: ConsultationContactInput): Record<string, string> {
  const errors = validateFirstContact(consultationContactForm(input));
  if (input.zip.trim() && !/^\d{5}$/.test(input.zip.trim())) errors.zip = 'Bitte eine fünfstellige Postleitzahl eingeben.';
  if (input.dateOfBirth && (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateOfBirth) || !Number.isFinite(Date.parse(input.dateOfBirth))
    || new Date(input.dateOfBirth).toISOString().slice(0, 10) !== input.dateOfBirth || input.dateOfBirth > new Date().toISOString().slice(0, 10))) {
    errors.dateOfBirth = 'Bitte ein gültiges Geburtsdatum angeben.';
  }
  return errors;
}

/** Selection feedback only; visits obtain their snapshot from the server. */
export function consultationContactSelection(id: string, form: ClientIntakeFormData): ConsultationClient {
  return { id, name: [form.firstName, form.lastName].filter(Boolean).join(' '),
    address: [[form.street, form.houseNumber].filter(Boolean).join(' '), [form.zip, form.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    phone: form.mobile || form.phone, care_grade: form.careLevel, payer: '', insurance_number: '', access_notes: form.accessNotes, notes: '',
  };
}

export function matchingConsultationContacts(input: ConsultationContactInput, clients: ConsultationClient[]): ConsultationClient[] {
  const normalize = (s: string) => s.toLocaleLowerCase('de-DE').normalize('NFKC').replace(/\s+/g, ' ').trim();
  const name = normalize([input.firstName, input.lastName].filter(Boolean).join(' '));
  const phone = (s: string) => s.replace(/\D/g, '').replace(/^0049/, '0').replace(/^49(?=\d{7})/, '0');
  const numbers = [input.phone, input.mobile].map(phone).filter(n => n.length >= 7);
  return clients.filter(c => (name.length >= 3 && normalize(c.name) === name) || numbers.includes(phone(c.phone ?? ''))).slice(0, 5);
}
