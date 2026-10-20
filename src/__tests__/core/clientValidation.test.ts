import { describe, expect, it } from 'vitest';
import { validateClientFormStep, hasErrors } from '@/lib/office/clientFormValidation';
import { EMPTY_CLIENT_FORM } from '@/types/forms/clientForm';

describe('Client Validation', () => {
  it('fordert Vor- und Nachname in Schritt 0', () => {
    const errors = validateClientFormStep(0, { ...EMPTY_CLIENT_FORM, firstName: '', lastName: '' });
    expect(hasErrors(errors)).toBe(true);
    expect(errors.firstName).toBeTruthy();
    expect(errors.lastName).toBeTruthy();
  });

  it('validiert Geburtsdatum-Format', () => {
    const errors = validateClientFormStep(0, {
      ...EMPTY_CLIENT_FORM,
      firstName: 'Erika',
      lastName: 'Test',
      dateOfBirth: '01.01.1990',
    });
    expect(errors.dateOfBirth).toBeTruthy();
  });

  it('fordert Adresse in Schritt 1', () => {
    const errors = validateClientFormStep(1, EMPTY_CLIENT_FORM);
    expect(errors.street).toBeTruthy();
    expect(errors.zip).toBeTruthy();
    expect(errors.city).toBeTruthy();
  });

  it('fordert Pflegegrad und Abrechnung in Schritt 2', () => {
    const errors = validateClientFormStep(2, {
      ...EMPTY_CLIENT_FORM,
      firstName: 'Erika',
      lastName: 'Test',
      careLevel: 'PG 2',
    });
    expect(errors.careFundName).toBeTruthy();
    expect(errors.billingType).toBeTruthy();
    expect(errors.hourlyRate).toBeTruthy();
  });

  it('fordert Notfallkontakt in Schritt 3', () => {
    const errors = validateClientFormStep(3, EMPTY_CLIENT_FORM);
    expect(errors.emergencyContactName).toBeTruthy();
    expect(errors.taskCategories).toBeTruthy();
  });
});
