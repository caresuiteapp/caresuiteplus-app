import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  fetchInvoiceDunningCases,
  fetchInvoicePayments,
  fetchInvoiceRuns,
} from '@/lib/office/invoiceExtensionService';

const root = path.join(__dirname, '..', '..', '..');

describe('Office Phase 4 batch routes', () => {
  it('invoice extension routes point to dedicated screens', () => {
    expect(readFileSync(path.join(root, 'app/business/office/invoices/runs.tsx'), 'utf8')).toContain(
      'InvoiceRunsScreen',
    );
    expect(readFileSync(path.join(root, 'app/business/office/invoices/payments.tsx'), 'utf8')).toContain(
      'InvoicePaymentsScreen',
    );
    expect(readFileSync(path.join(root, 'app/business/office/invoices/dunning.tsx'), 'utf8')).toContain(
      'InvoiceDunningScreen',
    );
    expect(readFileSync(path.join(root, 'app/business/office/permissions.tsx'), 'utf8')).toContain(
      'OfficePermissionsScreen',
    );
  });

  it('list screens expose audit states at screen level', () => {
    for (const file of ['EmployeesListScreen.tsx', 'InvoicesListScreen.tsx']) {
      const source = readFileSync(path.join(root, 'src/screens/office', file), 'utf8');
      expect(source).toContain('LoadingState');
      expect(source).toContain('EmptyState');
      expect(source).toContain('ErrorState');
    }
  });

  it('QmDashboard removes preparedOnly audit penalty', () => {
    const source = readFileSync(path.join(root, 'src/screens/qm/QmDashboardScreen.tsx'), 'utf8');
    expect(source).not.toMatch(/preparedOnly:\s*true/);
    expect(source).toContain('LoadingState');
    expect(source).toContain('EmptyState');
  });
});

describe('Office Phase 4 services', () => {
  it('loads invoice extension demo data', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const runs = await fetchInvoiceRuns(DEMO_TENANT_ID, 'business_admin');
    const payments = await fetchInvoicePayments(DEMO_TENANT_ID, 'business_admin');
    const dunning = await fetchInvoiceDunningCases(DEMO_TENANT_ID, 'business_admin');
    expect(runs.ok && runs.data.length).toBeGreaterThan(0);
    expect(payments.ok && payments.data.length).toBeGreaterThan(0);
    expect(dunning.ok).toBe(true);
    vi.unstubAllEnvs();
  });

  it('access management service exposes async fetch helpers', () => {
    const source = readFileSync(path.join(root, 'src/lib/auth/accessManagementService.ts'), 'utf8');
    expect(source).toContain('fetchAccessDashboardStats');
    expect(source).toContain('fetchRolePermissionProfiles');
  });

  it('OfficePermissionsScreen uses module assignment service', () => {
    const source = readFileSync(
      path.join(root, 'src/screens/business/office/OfficePermissionsScreen.tsx'),
      'utf8',
    );
    expect(source).toContain('fetchModuleAssignmentList');
    expect(source).toContain('LoadingState');
    expect(source).toContain('EmptyState');
  });
});
