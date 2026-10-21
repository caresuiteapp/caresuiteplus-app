import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { COMMUNICATION_CHOICES, getIntake2027Fields, MEDIA_CHOICES, validIntakeLegalDetails } from './intake2027Fields';

const contexts: Record<string, string> = { daily_assistance: 'Alltagsbegleitung', support_care: 'Betreuung', companionship: 'Begleitung', ambulatory_care: 'Ambulante Pflege', stationary_care: 'Stationäre Pflege', consulting: 'Beratung', academy_prepared: 'Akademie / Schulung (vorbereitet)' };
export function buildIntake2027Context(form: ClientIntakeFormData): Record<string, string> {
  const values = validIntakeLegalDetails(form.intakeLegalDetails) ? form.intakeLegalDetails : {};
  const result = Object.fromEntries(Object.entries(values).map(([key, value]) => [`legal.${key}`, value.trim()]));
  for (const field of getIntake2027Fields(['client_contract_assist', 'client_contract_care_consulting'], form)) {
    if (field.choices && field.choices.length > 1 && !field.choices.includes(values[field.key]?.trim())) result[`legal.${field.key}`] = '';
  }
  for (const key of ['signer.name', 'employee.name']) if (values[key]?.length > 200 || /[\r\n]/.test(values[key] ?? '')) result[`legal.${key}`] = '';
  const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
  if (values['signer.capacity'] === 'Die betreute Person selbst' && normalizeName(values['signer.name'] ?? '') !== normalizeName(`${form.firstName} ${form.lastName}`)) result['legal.signer.name'] = '';
  const selected = (choices: readonly { key: string; label: string }[]) => choices.filter(choice => values[choice.key] === 'yes').map(choice => `✓ ${choice.label}`).join('\n');
  result['legal.communication_choices'] = selected(COMMUNICATION_CHOICES);
  result['legal.media_choices'] = selected(MEDIA_CHOICES);
  result['legal.service_labels'] = form.careContexts.map(key => contexts[key] ?? '').filter(Boolean).join(', ');
  result['legal.signer.authority_text'] = values['signer.capacity'] === 'Die betreute Person selbst'
    ? 'Die betreute Person erklärt selbst.' : values['signer.capacity'] === 'Eine bevollmächtigte oder rechtliche Vertretung'
      ? values['signer.authority']?.trim() || '' : '';
  if (values['communication.email'] === 'yes' && !form.email.trim()) result['legal.communication_choices'] = '';
  if ((values['communication.phone'] === 'yes' || values['communication.sms'] === 'yes') && !form.phone.trim() && !form.mobile.trim()) result['legal.communication_choices'] = '';
  return result;
}

export const INTAKE_PAPER_CONTRACT_NOTICE = 'Für den Wohn- und Betreuungsvertrag ist der schriftliche Abschluss auf Papier erforderlich (§ 6 WBVG). Die vollständige Fassung kann vorbereitet und gedruckt werden; eine Bildschirmunterschrift ersetzt das Original nicht. Diese Ausgabe kann in diesem Ablauf nicht digital abgeschlossen werden.';
