import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { fetchEmployeeDetail } from '@/lib/office/employeeDetailService';
import { updateEmployee } from '@/lib/office/employeeFormService';
import { fetchInvoiceDetail, updateInvoice } from '@/lib/office/invoiceDetailService';
import { createInvoice } from '@/lib/office/invoiceCreateService';

const root = path.join(__dirname, '..', '..', '..');

describe('Office employee & invoice CRUD audit screens', () => {
  it('employee detail/create/edit screens expose audit markers', () => {
    const detail = readFileSync(path.join(root, 'src/screens/office/EmployeeDetailScreen.tsx'), 'utf8');
    expect(detail).toContain('LoadingState');
    expect(detail).toContain('EmptyState');
    expect(detail).toContain('ErrorState');
    expect(detail).toContain('fetchEmployeeDetail');

    for (const file of ['EmployeeCreateScreen.tsx', 'EmployeeEditScreen.tsx']) {
      const source = readFileSync(path.join(root, 'src/screens/office', file), 'utf8');
      expect(source).toMatch(/PremiumInput|CatalogValueSelect/);
      expect(source).toMatch(/createEmployee|updateEmployee|fetchEmployeeDetail/);
    }
  });

  it('invoice detail/create/edit screens expose audit markers', () => {
    const detail = readFileSync(path.join(root, 'src/screens/office/InvoiceDetailScreen.tsx'), 'utf8');
    expect(detail).toContain('LoadingState');
    expect(detail).toContain('EmptyState');
    expect(detail).toContain('ErrorState');
    expect(detail).toContain('fetchInvoiceDetail');

    for (const file of ['InvoiceCreateScreen.tsx', 'InvoiceEditScreen.tsx']) {
      const source = readFileSync(path.join(root, 'src/screens/office', file), 'utf8');
      expect(source).toMatch(/PremiumInput|CatalogValueSelect/);
      expect(source).toMatch(/createInvoice|updateInvoice|fetchInvoiceDetail/);
    }
  });

  it('invoice edit route exists', () => {
    const source = readFileSync(path.join(root, 'app/business/office/invoices/[id]/edit.tsx'), 'utf8');
    expect(source).toContain('InvoiceEditScreen');
  });

  it('QM subroutes use fetch services in screen files', () => {
    for (const file of [
      'QmHandbookScreen.tsx',
      'QmAuditsScreen.tsx',
      'QmMeasuresScreen.tsx',
      'MdAuditCenterScreen.tsx',
      'QmHandbookChapterScreen.tsx',
    ]) {
      const source = readFileSync(path.join(root, 'src/screens/qm', file), 'utf8');
      expect(source).toContain('LoadingState');
      expect(source).toContain('EmptyState');
      expect(source).toContain('ErrorState');
      expect(source).toMatch(/fetch[A-Z]|useAsyncQuery/);
    }
  });
});

describe('Office employee & invoice services', () => {
  it('loads and updates demo employee', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const detail = await fetchEmployeeDetail('employee-001', DEMO_TENANT_ID, 'business_admin');
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      const updated = await updateEmployee(
        'employee-001',
        DEMO_TENANT_ID,
        {
          roleKey: detail.data.jobTitle ?? 'Test',
          phone: detail.data.phone ?? '',
          departmentKey: detail.data.department ?? 'Allgemein',
          notes: 'Phase4 test',
        } as import('@/types/forms/employeeEditForm').EmployeeEditFormData,
        'business_admin',
      );
      expect(updated.ok).toBe(true);
    }
    vi.unstubAllEnvs();
  });

  it('loads and updates demo invoice', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const detail = await fetchInvoiceDetail('inv-001', DEMO_TENANT_ID, 'business_admin');
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      const updated = await updateInvoice(
        'inv-001',
        DEMO_TENANT_ID,
        { notes: 'Testnotiz', dueDate: detail.data.dueDate.slice(0, 10) },
        'business_admin',
      );
      expect(updated.ok).toBe(true);
    }
    const created = await createInvoice(DEMO_TENANT_ID, { title: 'Testrechnung Phase4' }, 'business_admin');
    expect(created.ok).toBe(true);
    vi.unstubAllEnvs();
  });
});
