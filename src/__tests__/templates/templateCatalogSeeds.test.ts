import { describe, expect, it } from 'vitest';
import {
  getAllCatalogEntries,
  getAllSystemTemplates,
  seedDefaultTemplatesForTenant,
} from '@/data/demo/templates';
import { getDropdownOptions } from '@/lib/templates';
import {
  getSampleVariableValues,
  getTemplateVariableKeys,
  renderTemplateWithVariables,
  TEMPLATE_VARIABLES,
} from '@/lib/templates/templateVariables';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

describe('template catalog seeds', () => {
  it('has at least 150 system templates', () => {
    const templates = getAllSystemTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(150);
  });

  it('has at least 200 catalog entries', () => {
    const catalogs = getAllCatalogEntries();
    expect(catalogs.length).toBeGreaterThanOrEqual(200);
  });

  it('includes required global status catalog counts', () => {
    const catalogs = getAllCatalogEntries();
    const count = (type: string) => catalogs.filter((c) => c.catalogType === type).length;
    expect(count('client_status')).toBe(16);
    expect(count('employee_status')).toBe(13);
    expect(count('assignment_status')).toBe(19);
    expect(count('document_status')).toBe(10);
    expect(count('invoice_status')).toBe(12);
    expect(count('message_status')).toBe(10);
  });

  it('includes document and upload category counts', () => {
    const catalogs = getAllCatalogEntries();
    expect(catalogs.filter((c) => c.catalogType === 'document_category').length).toBe(73);
    expect(catalogs.filter((c) => c.catalogType === 'upload_category').length).toBe(16);
    expect(catalogs.filter((c) => c.catalogType === 'assignment_target').length).toBe(11);
  });

  it('dropdown options are non-empty for MVP catalog types', async () => {
    const types = [
      'client_status',
      'document_category',
      'upload_category',
      'assignment_status',
      'sis_topic',
    ] as const;
    for (const catalogType of types) {
      const result = await getDropdownOptions(DEMO_TENANT_ID, catalogType, 'business_admin');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.length).toBeGreaterThan(0);
      }
    }
  });

  it('renderTemplateWithVariables replaces known placeholders', () => {
    const rendered = renderTemplateWithVariables(
      'Rechnung {{invoiceNumber}} für {{clientName}}',
      { invoiceNumber: 'RE-1', clientName: 'Test Klient' },
    );
    expect(rendered).toBe('Rechnung RE-1 für Test Klient');
  });

  it('Section 19 template variables are defined', () => {
    expect(TEMPLATE_VARIABLES.length).toBeGreaterThanOrEqual(40);
    expect(getTemplateVariableKeys()).toContain('clientName');
    expect(getSampleVariableValues().clientName).toBeTruthy();
  });

  it('seedDefaultTemplatesForTenant clones for tenant', () => {
    const { templates, catalogEntries } = seedDefaultTemplatesForTenant('tenant-test-001');
    expect(templates.length).toBe(getAllSystemTemplates().length);
    expect(catalogEntries.length).toBe(getAllCatalogEntries().length);
    expect(templates.every((t) => t.tenantId === 'tenant-test-001')).toBe(true);
    expect(catalogEntries.every((e) => e.tenantId === 'tenant-test-001')).toBe(true);
  });
});
