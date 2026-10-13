import { describe, expect, it } from 'vitest';
import { validateIntakeStep } from '@/lib/clients/clientIntakeValidation';
import { createEmptyIntakeForm } from '@/lib/clients/clientIntakeService';

describe('intake validation matches visible workflow requirements', () => {
  it('rejects impossible calendar values and future births while allowing a future service start', () => {
    const form = { ...createEmptyIntakeForm(), firstName: 'Anna', lastName: 'Muster', careContexts: ['daily_assistance' as const], dateOfBirth: '1940-02-31', serviceStart: '2099-01-01' };
    expect(validateIntakeStep('stammdaten', form).dateOfBirth).toBeTruthy();
    expect(validateIntakeStep('stammdaten', { ...form, dateOfBirth: '2099-01-01' }).dateOfBirth).toContain('Zukunft');
    expect(validateIntakeStep('stammdaten', { ...form, dateOfBirth: '1940-02-29' })).toEqual({});
  });
  it('does not force the optional service-start field for stationary-only intake', () => {
    const form = { ...createEmptyIntakeForm(), firstName: 'Anna', lastName: 'Muster', careContexts: ['stationary_care' as const], dateOfBirth: '1940-01-01' };
    expect(validateIntakeStep('stammdaten', form).serviceStart).toBeUndefined();
  });
  it('rejects malformed postcode/email even when the contact requirement is nonempty', () => {
    const form = { ...createEmptyIntakeForm(), street: 'Hauptstraße', zip: 'ABCDE', city: 'Berlin', email: 'kein-email' };
    const errors = validateIntakeStep('adresse_kontakt', form);
    expect(errors.zip).toBeTruthy(); expect(errors.email).toBeTruthy();
    expect(validateIntakeStep('adresse_kontakt', { ...form, zip: '10115', email: 'anna@example.test' })).toEqual({});
  });
  it('requires a stationary ward and surfaces it on the access section', () => {
    const form = { ...createEmptyIntakeForm(), careContexts: ['stationary_care' as const], facilityName: 'Haus', roomNumber: '10' };
    expect(validateIntakeStep('notfall_zugang', form).careArea).toBeTruthy();
    expect(validateIntakeStep('notfall_zugang', { ...form, careArea: 'Nord' }).careArea).toBeUndefined();
  });
});
