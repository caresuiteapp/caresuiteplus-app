import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  getEmployeePortalImpactSummary,
  sanitizeClientPortalPayload,
  sanitizeEmployeePortalPayload,
} from '@/lib/portal/portalVisibilityService';
import { canClientPortalSeeFeature } from '@/lib/client/clientPortalSettingsService';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('portal projection services', () => {
  it('exports client and employee projection service modules', () => {
    expect(readSrc('src/lib/portal/clientPortalProjectionService.ts')).toContain(
      'getClientPortalProjection',
    );
    expect(readSrc('src/lib/portal/employeePortalProjectionService.ts')).toContain(
      'getEmployeePortalProjection',
    );
    expect(readSrc('src/lib/portal/employeePortalProjectionService.ts')).toContain(
      'fetchLiveEmployeePortalOverview',
    );
    expect(readSrc('src/lib/portal/portalVisibilityService.ts')).toContain(
      'getPortalVisibilityMatrixForClient',
    );
    expect(readSrc('src/types/portalSystem.ts')).toContain('PortalSyncState');
  });

  it('portal shells exist for client and employee', () => {
    expect(readSrc('src/components/portal/PortalShell.tsx')).toContain("kind: PortalKind");
    expect(readSrc('src/components/portal/ClientPortalShell.tsx')).toContain('ClientPortalShell');
    expect(readSrc('src/components/portal/EmployeePortalShell.tsx')).toContain('EmployeePortalShell');
    expect(readSrc('app/portal/client/_layout.tsx')).toContain('ClientPortalShell');
    expect(readSrc('app/portal/employee/_layout.tsx')).toContain('EmployeePortalShell');
  });

  it('employee impact summary blocks budget and full record', () => {
    const impact = getEmployeePortalImpactSummary();
    expect(impact.showsBudget).toBe(false);
    expect(impact.showsInvoices).toBe(false);
    expect(impact.showsFullClientRecord).toBe(false);
    expect(impact.gpsTrackingEmployeePortalOnly).toBe(true);
  });

  it('client portal never exposes visit_tracking', () => {
    const settings = {
      portalEnabled: true,
      showAppointments: true,
      showMessages: false,
      showDocuments: false,
      showProofs: true,
      showBudget: false,
      showVisitTracking: true,
      inheritTenantDefaults: false,
      source: 'client' as const,
    };
    expect(canClientPortalSeeFeature(settings, 'visit_tracking')).toBe(false);
  });

  it('sanitizers strip blocked keys', () => {
    const client = sanitizeClientPortalPayload({ title: 'Ok', fahrtenbuch: '12km', latitude: 1 });
    expect(client.title).toBe('Ok');
    expect(client).not.toHaveProperty('fahrtenbuch');
    expect(client).not.toHaveProperty('latitude');

    const employee = sanitizeEmployeePortalPayload({ name: 'Ok', payroll: 1, budgetCents: 2 });
    expect(employee.name).toBe('Ok');
    expect(employee).not.toHaveProperty('payroll');
    expect(employee).not.toHaveProperty('budgetCents');
  });

  it('office portal tab includes employee impact and sync chain', () => {
    const panel = readSrc('src/components/office/ClientPortalCorePanel.tsx');
    expect(panel).toContain('EmployeePortalImpactPanel');
    expect(panel).toContain('PortalSyncChainPanel');
  });
});
