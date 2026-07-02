import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildOfficeDashboard, OFFICE_AREA_SHORTCUTS } from '@/data/demo/officeDashboard';
import { enforcePermission } from '@/lib/permissions';
import {
  OFFICE_WORKSPACE_KPI_COUNT,
  OFFICE_SIDEBAR_QUICK_ACTIONS,
  buildOfficeWorkspaceKpis,
} from '@/lib/office/officeDashboardWorkspace';
import { emptyOfficeDashboardMetrics } from '@/lib/office/officeDashboardMetrics';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Office dashboard workspace', () => {
  it('enforcePermission schützt Dashboard-Service', () => {
    expect(enforcePermission(null, 'office.access' as never)).not.toBeNull();
  });

  it('buildOfficeDashboard liefert Office-Verwaltungszentrale', () => {
    const snapshot = buildOfficeDashboard('business_admin');
    expect(snapshot.scope).toBe('office');
    expect(snapshot.moduleLabel).toBe('CareSuite+ Office');
    expect(snapshot.kpis).toHaveLength(OFFICE_WORKSPACE_KPI_COUNT);
    expect(snapshot.statusCards.length).toBeGreaterThan(0);
    expect(snapshot.activities.length).toBeGreaterThan(0);
    expect(snapshot.primaryAction.route).toBeTruthy();
    expect(snapshot.heroSubtitle).toContain('Verwaltung');
    expect(snapshot.moduleOverviewRows).toBeUndefined();
  });

  it('buildOfficeWorkspaceKpis liefert 8 Office-KPIs mit Routen', () => {
    const kpis = buildOfficeWorkspaceKpis({
      ...emptyOfficeDashboardMetrics(),
      activeClients: 3,
      totalClients: 5,
      tableAvailability: {
        ...emptyOfficeDashboardMetrics().tableAvailability,
        clients: true,
        employees: true,
        messages: true,
        documents: true,
        portalRequests: true,
        serviceRecords: true,
        invoices: true,
        tasks: true,
        appointments: true,
      },
    });

    expect(kpis).toHaveLength(8);
    expect(kpis.find((k) => k.id === 'office-ws-kpi-clients-active')?.route).toBe('/office/clients?status=aktiv');
    expect(kpis.find((k) => k.id === 'office-ws-kpi-billing')?.route).toBe('/office/billing-preparation');
    expect(kpis.every((k) => typeof k.route === 'string')).toBe(true);
  });

  it('Sidebar-Schnellaktionen ohne Rechnung erstellen', () => {
    expect(OFFICE_SIDEBAR_QUICK_ACTIONS.some((a) => a.label.includes('Rechnung erstellen'))).toBe(false);
    expect(OFFICE_SIDEBAR_QUICK_ACTIONS.some((a) => a.label === 'Abrechnung prüfen')).toBe(true);
    expect(OFFICE_SIDEBAR_QUICK_ACTIONS).toHaveLength(8);
  });

  it('Arbeitsbereiche haben echte Routen ohne Platzhalter', () => {
    for (const area of OFFICE_AREA_SHORTCUTS) {
      expect(area.route.startsWith('/')).toBe(true);
      expect(area.title.length).toBeGreaterThan(2);
    }
    expect(OFFICE_AREA_SHORTCUTS.some((a) => a.route === '/office/clients')).toBe(true);
  });

  it('OfficeIndexScreen nutzt HealthOS Command Center', () => {
    const source = readSrc('src/screens/office/OfficeIndexScreen.tsx');
    expect(source).toContain('HealthOSOfficeCommandCenterView');
    expect(source).toContain('useOfficeDashboard');
    expect(source).toContain('HealthOSModuleShell');
    expect(source).toContain('Command Center');
    expect(source).not.toContain('Coming Soon');
  });

  it('HealthOSOfficeCommandCenterView ist Office-Steuerungszentrale', () => {
    const source = readSrc('src/components/healthos/office/HealthOSOfficeCommandCenterView.tsx');
    expect(source).toContain('HealthOSLoadingState');
    expect(source).toContain('HealthOSErrorState');
    expect(source).toContain('HealthOSEmptyState');
    expect(source).toContain('onRefresh');
    expect(source).toContain('Betriebsstatus heute');
    expect(source).toContain('buildOfficeCommandCenterModel');
    expect(source).not.toContain('ModuleOverviewDashboard');
    expect(source).not.toContain('Zentrale Dashboard');
    expect(source).not.toContain('Coming Soon');
  });

  it('platformContextData mappt Sidebar-Aktionen ohne Rechnung erstellen', () => {
    const source = readSrc('src/components/layout/platform/platformContextData.ts');
    const workspace = readSrc('src/lib/office/officeDashboardWorkspace.ts');
    expect(source).toContain('OFFICE_SIDEBAR_QUICK_ACTIONS');
    expect(source).not.toContain('Rechnung erstellen');
    expect(workspace).toContain('Abrechnung prüfen');
  });
});
