import { describe, it, expect } from 'vitest';
import { EMPTY_CLIENT_INTAKE_FORM as empty, type ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { CLIENT_INTAKE_PLANS, getRequiredFieldsForIntake, validateFirstContact } from '@/lib/clients/clientIntakePlan';
import { resolveContractTemplateKeys, listApplicableIntakeTemplates } from '@/features/intakeDocuments/buildIntakeDocumentContext';
import { mergeIntakeFormWithDefaults } from '@/lib/clients/clientIntakeDraftStorage';
import { validateIntakeStep } from '@/lib/clients/clientIntakeValidation';

const full = (patch: Partial<ClientIntakeFormData> = {}): ClientIntakeFormData => ({ ...structuredClone(empty), intakeWorkflowVersion: 2, ...patch });
describe('context-specific intake and first contact', () => {
  it.each(Object.keys(CLIENT_INTAKE_PLANS))('has matching requirements and contract for %s', key => {
    const context = key as keyof typeof CLIENT_INTAKE_PLANS;
    const form = full({ careContexts: [context] });
    const contracts = resolveContractTemplateKeys(form);
    expect(contracts).toHaveLength(context === 'academy_prepared' ? 0 : 1);
    expect(getRequiredFieldsForIntake(form)).toEqual(expect.arrayContaining(CLIENT_INTAKE_PLANS[context].required));
    if (context === 'consulting') expect(getRequiredFieldsForIntake(form)).not.toEqual(expect.arrayContaining(['careLevel']));
  });
  it('combines all seven contexts without losing stationary or support requirements', () => {
    const form = full({ careContexts: Object.keys(CLIENT_INTAKE_PLANS) as ClientIntakeFormData['careContexts'], intakeContractType: 'day_care' });
    expect(resolveContractTemplateKeys(form)).toEqual(['client_contract_assist', 'client_contract_ambulatory_care', 'client_contract_stationary_care', 'client_contract_care_consulting']);
    expect(listApplicableIntakeTemplates(form)).toHaveLength(5);
    expect(getRequiredFieldsForIntake(form)).toEqual(expect.arrayContaining(['supportWishes', 'familyDoctor', 'homeAccess', 'facility', 'roomNumber', 'consultingReason']));
    expect(validateIntakeStep('notfall_zugang', form)).toMatchObject({ facilityName: expect.any(String), roomNumber: expect.any(String), homeAccess: expect.any(String) });
  });
  it('preserves the original selection for a legacy/native draft', () => {
    expect(resolveContractTemplateKeys({ ...empty, careContexts: ['daily_assistance', 'ambulatory_care'], intakeContractType: 'day_care' })).toEqual(['client_contract_day_care']);
  });
  it('accepts contact data without a birthday, care grade, contracts, service choice or appointment', () => {
    expect(validateFirstContact(full({ intakeStage: 'first_contact', lastName: 'Beispiel', phone: '03012345' }))).toEqual({});
    expect(validateFirstContact(full())).toMatchObject({ lastName: expect.any(String), phone: expect.any(String) });
  });
  it('requires valid contact and appointment times only when a calendar entry is requested', () => {
    const form = full({ lastName: 'Beispiel', email: 'ungueltig', intakeAppointmentRequested: true, intakeAppointmentStart: '2026-11-01T11:00', intakeAppointmentEnd: '2026-11-01T10:00' });
    expect(validateFirstContact(form)).toMatchObject({ email: expect.any(String), intakeAppointmentEnd: expect.any(String) });
    expect(validateFirstContact({ ...form, email: 'beispiel@example.invalid', intakeAppointmentEnd: '2026-11-01T12:00' })).toEqual({});
  });
  it('restores the first contact exactly for later completion, including the calendar request', () => {
    const form = full({ intakeStage: 'first_contact', lastName: 'Beispiel', phone: '03012345', intakeContactPerson: 'Angehörige', intakeContactNotes: 'Rückruf am Nachmittag', intakeAppointmentRequested: true, intakeAppointmentStart: '2026-11-01T11:00', intakeAppointmentEnd: '2026-11-01T12:00', intakeAppointmentLocation: 'Zu Hause' });
    expect(mergeIntakeFormWithDefaults(JSON.parse(JSON.stringify(form)))).toEqual(form);
  });
  it('keeps academy-only interest as a draft and never invents an Assist contract', () => {
    const form = full({ careContexts: ['academy_prepared'], lastName: 'Beispiel', phone: '03012345' });
    expect(validateFirstContact(form)).toEqual({});
    expect(validateIntakeStep('leistungsart', form).careContexts).toContain('vorbereitet');
    expect(resolveContractTemplateKeys(form)).toEqual([]);
  });
});
