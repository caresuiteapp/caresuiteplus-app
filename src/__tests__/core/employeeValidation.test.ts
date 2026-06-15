import { describe, expect, it } from 'vitest';
import { validateEmployeeForm, hasEmployeeErrors } from '@/lib/office/employeeFormValidation';
import { EMPTY_EMPLOYEE_FORM } from '@/types/forms/employeeForm';

describe('Employee Validation', () => {
  it('lehnt leeres Formular ab', () => {
    const errors = validateEmployeeForm(EMPTY_EMPLOYEE_FORM);
    expect(hasEmployeeErrors(errors)).toBe(true);
    expect(errors.firstName).toBeTruthy();
    expect(errors.email).toBeTruthy();
  });

  it('akzeptiert gültige Stammdaten', () => {
    const errors = validateEmployeeForm({
      ...EMPTY_EMPLOYEE_FORM,
      firstName: 'Anna',
      lastName: 'Krüger',
      email: 'anna@demo.caresuiteplus.app',
      jobTitle: 'Pflegefachkraft',
    });
    expect(hasEmployeeErrors(errors)).toBe(false);
  });
});
