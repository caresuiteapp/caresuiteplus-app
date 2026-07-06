import { describe, expect, it } from 'vitest';
import {
  countPortalSignatureDashboard,
  filterPortalSignatureDocuments,
  resolveNextSignerRole,
  resolveStatusAfterCapture,
} from '@/lib/portal/portalDocumentSignatureHelpers';
import { buildEmployeePortalTodayModel } from '@/lib/portal/employee/employeePortalTodayModel';
import type { PortalSignatureDocument } from '@/types/portal/documentSignatures';
import type { EmployeePortalDashboardProjection } from '@/types/portalSystem';

function sampleDoc(overrides: Partial<PortalSignatureDocument> = {}): PortalSignatureDocument {
  return {
    id: 'doc-1',
    tenantId: 'tenant-1',
    title: 'Test',
    documentType: 'sonstiges',
    recipientType: 'employee',
    employeeId: 'emp-1',
    clientId: null,
    clientName: null,
    signatureRequirement: 'employee',
    dueDate: null,
    priority: 'normal',
    requiredBeforeAssignment: false,
    assignmentId: null,
    status: 'open',
    creatorName: 'Office',
    createdAt: '2026-07-01T08:00:00.000Z',
    sentAt: '2026-07-01T08:00:00.000Z',
    completedAt: null,
    allowDownload: true,
    previewHtml: null,
    previewPdfUrl: null,
    storagePath: null,
    sourceDocumentId: null,
    documentSourceType: 'office_write',
    signatureFields: [],
    versionNumber: 1,
    employeeSigned: false,
    clientSigned: false,
    nextSignerRole: 'employee',
    ...overrides,
  };
}

describe('portal document signature helpers', () => {
  it('filters open documents', () => {
    const docs = [
      sampleDoc({ id: '1', status: 'open' }),
      sampleDoc({ id: '2', status: 'completed' }),
    ];
    expect(filterPortalSignatureDocuments(docs, 'open')).toHaveLength(1);
    expect(filterPortalSignatureDocuments(docs, 'completed')).toHaveLength(1);
  });

  it('resolves sequential signing order', () => {
    const both = sampleDoc({ signatureRequirement: 'both_sequential' });
    expect(resolveNextSignerRole(both)).toBe('employee');
    expect(
      resolveNextSignerRole({ ...both, employeeSigned: true, clientSigned: false }),
    ).toBe('client');
    expect(
      resolveNextSignerRole({
        ...both,
        employeeSigned: true,
        clientSigned: true,
        status: 'completed',
      }),
    ).toBeNull();
  });

  it('marks document completed after all required signatures', () => {
    const afterEmployee = resolveStatusAfterCapture({
      signatureRequirement: 'employee',
      employeeSigned: true,
      clientSigned: false,
    });
    expect(afterEmployee).toBe('completed');
  });

  it('counts dashboard open and overdue documents', () => {
    const ref = new Date('2026-07-05T12:00:00.000Z');
    const docs = [
      sampleDoc({ dueDate: '2026-07-04T12:00:00.000Z', status: 'open' }),
      sampleDoc({ id: '2', dueDate: '2026-07-05T12:00:00.000Z', status: 'open' }),
    ];
    const counts = countPortalSignatureDashboard(docs, ref);
    expect(counts.openCount).toBe(2);
    expect(counts.overdueCount).toBe(1);
    expect(counts.dueTodayCount).toBe(1);
  });
});

describe('portal signature dashboard model', () => {
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
  it('employee drawer navigation includes Unterschriften', async () => {
    const { PORTAL_EMPLOYEE_DRAWER_TABS } = await import('@/lib/navigation/employeePortalNavigation');
    expect(PORTAL_EMPLOYEE_DRAWER_TABS.some((t) => t.key === 'signatures')).toBe(true);
  });

  it('healthos employee nav includes Unterschriften', async () => {
    const { HEALTHOS_EMPLOYEE_PORTAL_NAV } = await import(
      '@/components/healthos/navigation/healthosNavigationConfig'
    );
    const items = HEALTHOS_EMPLOYEE_PORTAL_NAV.groups.flatMap((group) => group.items);
    expect(items.some((item) => item.key === 'signatures')).toBe(true);
  });

  it('office nav includes Dokumente & Unterschriften', async () => {
    const { OFFICE_NAV_AREAS } = await import('@/lib/navigation/officeNavigation');
    expect(
      OFFICE_NAV_AREAS.some(
        (a) =>
          a.label === 'Dokumente & Unterschriften' &&
          a.href === '/business/office/documents/signatures',
      ),
    ).toBe(true);
  });

  it('module nav sidebar includes Dokumente & Unterschriften', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const nav = readFileSync(
      join(process.cwd(), 'src/lib/navigation/modulenav/officenav.ts'),
      'utf8',
    );
    expect(nav).toContain("label: 'Dokumente & Unterschriften'");
    expect(nav).toContain("href: '/business/office/documents/signatures'");
  });

  it('APP_ROUTES registers phase-2 documents signatures', async () => {
    const { APP_ROUTES } = await import('@/lib/navigation/routes');
    expect(APP_ROUTES.some((r) => r.path === '/business/office/documents/signatures')).toBe(true);
    expect(APP_ROUTES.some((r) => r.path === '/office/documents-signatures')).toBe(true);
    const office = APP_ROUTES.find((r) => r.path === '/office');
    expect(office?.children).toContain('/business/office/documents/signatures');
  });

  it('employee portal nav links cs signatures route', async () => {
    const { EMPLOYEE_PORTAL_NAV_TABS } = await import('@/lib/navigation/employeePortalNavigation');
    const signatures = EMPLOYEE_PORTAL_NAV_TABS.find((t) => t.key === 'signatures');
    expect(signatures?.href).toBe('/portal/employee/documents/signatures');
  });
});

describe('portal signature live-only facade', () => {
  it('service module declares live-only guard', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(
      join(process.cwd(), 'src/lib/portal/portalDocumentSignatureService.ts'),
      'utf8',
    );
    expect(source).toContain('Signaturdokumente sind nur im Live-Modus');
    expect(source).toContain('fetchLivePortalSignatureDocuments');
    expect(source).toContain('composeOfficeSignatureDocumentForPortal');
    expect(source).not.toContain('demoPortalSignatureDocuments');
  });
});
