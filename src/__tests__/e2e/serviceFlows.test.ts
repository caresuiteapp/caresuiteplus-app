import { describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { fetchAssignmentList } from '@/lib/assist/assignmentListService';
import { fetchPdlCockpit } from '@/lib/reporting/reportingService';
import { fetchBusinessModuleSnapshot } from '@/lib/business/businessModuleService';
import { validateClientFormStep, hasErrors } from '@/lib/office/clientFormValidation';
import { validateEmployeeForm } from '@/lib/office/employeeFormValidation';
import { EMPTY_CLIENT_FORM } from '@/types/forms/clientForm';

describe('E2E service layer — login & reporting', () => {
  it('accepts business_admin for PDL cockpit', async () => {
    const result = await fetchPdlCockpit(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.kpis.length).toBeGreaterThan(0);
      expect(result.data.risks).toBeDefined();
    }
  });
});

describe('E2E service layer — client CRUD validation', () => {
  it('validates client form fields', () => {
    const form = {
      ...EMPTY_CLIENT_FORM,
      firstName: 'E2E',
      lastName: 'Test',
      dateOfBirth: '1980-01-01',
      careLevel: '2',
      status: 'entwurf' as const,
      street: 'Musterweg 1',
      city: 'Berlin',
      zip: '10115',
    };
    expect(hasErrors(validateClientFormStep(0, form))).toBe(false);
    expect(hasErrors(validateClientFormStep(1, form))).toBe(false);
  });
});

describe('E2E service layer — employee CRUD validation', () => {
  it('validates employee form fields', () => {
    const errors = validateEmployeeForm({
      firstName: 'E2E',
      lastName: 'Mitarbeiter',
      jobTitle: 'Pflegekraft',
      email: 'e2e@example.com',
      phone: '',
      department: 'Ambulant',
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe('E2E service layer — assist assignments', () => {
  it('loads assignment list for dispatcher', async () => {
    const result = await fetchAssignmentList(DEMO_TENANT_ID, 'dispatch');
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.isArray(result.data)).toBe(true);
  });
});

describe('E2E service layer — business module snapshot', () => {
  it('returns demo module data for business_admin', async () => {
    const result = await fetchBusinessModuleSnapshot(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
