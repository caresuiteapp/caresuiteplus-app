import { describe, expect, it, beforeEach } from 'vitest';
import {
  countPortalSignatureDashboard,
  filterPortalSignatureDocuments,
  resetPortalDocumentSignatureStore,
  signPortalDocument,
  fetchPortalSignatureDocuments,
} from '@/lib/portal/portalDocumentSignatureService';
import { buildEmployeePortalTodayModel } from '@/lib/portal/employee/employeePortalTodayModel';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import type { EmployeePortalDashboardProjection } from '@/types/portalSystem';

describe('portal document signatures', () => {
  beforeEach(() => {
    resetPortalDocumentSignatureStore();
  });

  it('lists open signature documents for demo employee', async () => {
    const result = await fetchPortalSignatureDocuments(
      DEMO_TENANT_ID,
      'employee-003',
      'employee_portal',
      'open',
    );
    expect(result.ok).toBe(true);
    expect(result.data?.length).toBeGreaterThan(0);
  });

  it('filters overdue documents', async () => {
    const result = await fetchPortalSignatureDocuments(
      DEMO_TENANT_ID,
      'employee-003',
      'employee_portal',
      'overdue',
    );
    expect(result.ok).toBe(true);
    expect(result.data?.some((d) => d.id === 'psd-003')).toBe(true);
  });

  it('completes employee signature workflow', async () => {
    const signResult = await signPortalDocument(
      {
        tenantId: DEMO_TENANT_ID,
        documentId: 'psd-001',
        employeeId: 'employee-003',
        signerRole: 'employee',
        signerName: 'Sandra Meier',
        signatureDataUrl: 'data:image/png;base64,abc',
      },
      'employee_portal',
    );
    expect(signResult.ok).toBe(true);
    expect(signResult.data?.status).toBe('completed');
    expect(signResult.data?.employeeSigned).toBe(true);
  });

  it('counts dashboard metrics', async () => {
    const list = await fetchPortalSignatureDocuments(
      DEMO_TENANT_ID,
      'employee-003',
      'employee_portal',
      'open',
    );
    const counts = countPortalSignatureDashboard(list.data ?? []);
    expect(counts.openCount).toBeGreaterThan(0);
  });

  it('adds open signatures card to dashboard model', () => {
    const dashboard: EmployeePortalDashboardProjection = {
      todayAssignments: [],
      upcomingAssignments: [],
      openTasks: [],
      openDocumentationCount: 0,
      missingSignatureCount: 0,
      openSignatureDocumentCount: 3,
      overdueSignatureDocumentCount: 1,
      messageCount: 0,
    };
    const model = buildEmployeePortalTodayModel({
      dashboard,
      displayName: 'Test',
    });
    expect(model.openSignatures?.value).toBe(3);
    expect(model.offeneAufgaben.some((t) => t.id === 'task-document-signatures')).toBe(true);
  });
});

describe('portal signature navigation', () => {
  it('employee tabs include Unterschriften', async () => {
    const { PORTAL_EMPLOYEE_TABS } = await import('@/lib/navigation/shellConfig');
    expect(PORTAL_EMPLOYEE_TABS.some((t) => t.key === 'signatures')).toBe(true);
    expect(PORTAL_EMPLOYEE_TABS.find((t) => t.key === 'signatures')?.href).toBe(
      '/portal/employee/signatures',
    );
  });

  it('office nav includes Dokumente & Unterschriften', async () => {
    const { OFFICE_NAV_AREAS } = await import('@/lib/navigation/officeNavigation');
    expect(
      OFFICE_NAV_AREAS.some(
        (a) => a.label === 'Dokumente & Unterschriften' && a.href === '/office/documents-signatures',
      ),
    ).toBe(true);
  });
});
