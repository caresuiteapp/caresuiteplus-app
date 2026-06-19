import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildOfficeDashboard, OFFICE_AREA_SHORTCUTS } from '@/data/demo/officeDashboard';
import { fetchOfficeDashboard } from '@/lib/office/officeDashboardService';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Office dashboard', () => {
  it('enforcePermission schützt Dashboard-Service', () => {
    expect(enforcePermission(null, 'office.access' as never)).not.toBeNull();
  });

  it('fetchOfficeDashboard liefert Demo-Snapshot', async () => {
    const result = await fetchOfficeDashboard(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.scope).toBe('office');
      expect(result.data.moduleLabel).toBe('CareSuite+ Office');
      expect(result.data.kpis.length).toBeGreaterThanOrEqual(4);
      expect(result.data.statusCards.length).toBeGreaterThan(0);
      expect(result.data.activities.length).toBeGreaterThan(0);
      expect(result.data.primaryAction.route).toBeTruthy();
    }
  });

  it('buildOfficeDashboard nutzt echte Demo-Kennzahlen', () => {
    const snapshot = buildOfficeDashboard('business_admin');
    expect(snapshot.kpis.some((k) => k.id === 'office-kpi-clients-active')).toBe(true);
    expect(snapshot.kpis.some((k) => k.id === 'office-kpi-invoices')).toBe(true);
    expect(snapshot.heroSubtitle).toContain('Office');
  });

  it('Arbeitsbereiche haben echte Routen ohne Platzhalter', () => {
    for (const area of OFFICE_AREA_SHORTCUTS) {
      expect(area.route.startsWith('/')).toBe(true);
      expect(area.title.length).toBeGreaterThan(2);
    }
    expect(OFFICE_AREA_SHORTCUTS.some((a) => a.route === '/office/clients')).toBe(true);
    expect(OFFICE_AREA_SHORTCUTS.some((a) => a.route === '/office/invoices')).toBe(true);
  });

  it('OfficeIndexScreen nutzt OfficeDashboardView', () => {
    const source = readSrc('src/screens/office/OfficeIndexScreen.tsx');
    expect(source).toContain('OfficeDashboardView');
    expect(source).toContain('useOfficeDashboard');
    expect(source).not.toContain('Coming Soon');
  });

  it('OfficeDashboardView hat Loading, Error und KPI-Grid', () => {
    const source = readSrc('src/components/dashboard/OfficeDashboardView.tsx');
    expect(source).toContain('LoadingState');
    expect(source).toContain('ErrorState');
    expect(source).toContain('EmptyState');
    expect(source).toContain('onRefresh');
    expect(source).toContain('ZentraleDashboardHero');
    expect(source).toContain('AdaptiveKpiGrid');
    expect(source).not.toContain('Coming Soon');
    expect(source).not.toContain('onPress={() => {}}');
  });
});
