import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getPermissionsForRole } from '@/lib/permissions/staticRolePermissions';
import {
  canActivateConnectIntegration,
  CONNECT_DISPLAY_STATUS_LABELS,
  getCategoryDashboardStats,
  getProviderCompliance,
  resolveConnectDisplayStatus,
} from '@/lib/connect/connectPresentation';
import {
  getAllConnectIntegrations,
  getConnectCategories,
  getConnectCategory,
  isConnectIntegrationExecutable,
} from '@/lib/connect';
import { checkRoleAccess } from '@/lib/navigation';

const ADMIN = 'business_admin' as const;
const MANAGER = 'business_manager' as const;
const NURSE = 'nurse' as const;

function readConnectUiSource(): string {
  const roots = [
    path.join(process.cwd(), 'src/screens/connect'),
    path.join(process.cwd(), 'src/components/connect'),
  ];
  const files: string[] = [];
  for (const root of roots) {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
        files.push(path.join(root, entry.name));
      }
    }
  }
  return files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
}

describe('Connect Dashboard & Admin UI', () => {
  it('Admin hat connect.configure, Manager/Pflegekraft nicht', () => {
    expect(getPermissionsForRole(ADMIN)).toContain('connect.configure');
    expect(getPermissionsForRole(MANAGER)).not.toContain('connect.configure');
    expect(getPermissionsForRole(NURSE)).not.toContain('connect.configure');
  });

  it('Konfigurations-Screen ist rollenbasiert geschützt', () => {
    const configureSource = fs.readFileSync(
      path.join(process.cwd(), 'src/screens/connect/ConnectProviderConfigureScreen.tsx'),
      'utf8',
    );
    expect(configureSource).toContain("can('connect.configure')");
    expect(configureSource).toContain('LockedActionBanner');
  });

  it('Detail-Tab Konfiguration nur mit connect.configure', () => {
    const detailSource = fs.readFileSync(
      path.join(process.cwd(), 'src/screens/connect/ConnectIntegrationDetailScreen.tsx'),
      'utf8',
    );
    expect(detailSource).toContain("can('connect.configure')");
    expect(detailSource).toContain('LockedActionBanner');
  });

  it('keine Klartext-API-Keys in Connect-UI-Quellen', () => {
    const source = readConnectUiSource();
    expect(source).not.toMatch(/sk_live/i);
    expect(source).not.toMatch(/pk_live/i);
    expect(source).toMatch(/maskConnectCredentialReference/);
    expect(source).toMatch(/nicht wieder angezeigt/i);
  });

  it('coming_soon Anbieter können nicht aktiviert werden', () => {
    const comingSoon = getAllConnectIntegrations().filter((item) => item.readiness === 'coming_soon');
    expect(comingSoon.length).toBeGreaterThan(0);
    for (const integration of comingSoon) {
      expect(canActivateConnectIntegration(integration, true)).toBe(false);
      expect(resolveConnectDisplayStatus(integration)).toBe('coming_soon');
    }
  });

  it('disabled Anbieter sind nicht ausführbar', () => {
    const disabled = getAllConnectIntegrations().filter((item) => item.readiness === 'disabled');
    expect(disabled.length).toBeGreaterThan(0);
    for (const integration of disabled) {
      expect(isConnectIntegrationExecutable(integration)).toBe(false);
      expect(canActivateConnectIntegration(integration, true)).toBe(false);
      expect(resolveConnectDisplayStatus(integration)).toBe('disabled');
    }
  });

  it('Sandbox-Status liefert sicheren Warnhinweis', () => {
    expect(CONNECT_DISPLAY_STATUS_LABELS.sandbox).toContain('Sandbox aktiv');
    expect(CONNECT_DISPLAY_STATUS_LABELS.sandbox).toContain('keine Produktivdaten');
    const sandboxBanner = fs.readFileSync(
      path.join(process.cwd(), 'src/components/connect/ConnectSandboxBanner.tsx'),
      'utf8',
    );
    expect(sandboxBanner).toContain("status !== 'sandbox'");
    expect(sandboxBanner).toContain('CONNECT_DISPLAY_STATUS_LABELS.sandbox');
  });

  it('Gesundheitsdaten-Anbieter zeigen Datenschutzwarnung', () => {
    const tiKim = getConnectCategory('ti_kim');
    expect(tiKim).toBeDefined();
    const kim = tiKim!.integrations.find((item) => item.key === 'kim')!;
    const compliance = getProviderCompliance('ti_kim', kim);
    expect(compliance.mayTransferHealthData).toBe(true);
    expect(compliance.requiresAvv).toBe(true);

    const privacySource = fs.readFileSync(
      path.join(process.cwd(), 'src/components/connect/ConnectPrivacyWarning.tsx'),
      'utf8',
    );
    expect(privacySource).toContain('mayTransferHealthData');
    expect(privacySource).toContain('AVV');
    expect(privacySource).toContain('Rechtsgrundlage');
    expect(privacySource).toContain('Audit');
  });

  it('Dashboard-Karten zeigen Status, Anbieter, Hinweise und Sync', () => {
    const cardSource = fs.readFileSync(
      path.join(process.cwd(), 'src/components/connect/ConnectCategoryDashboardCard.tsx'),
      'utf8',
    );
    expect(cardSource).toContain('CONNECT_DISPLAY_STATUS_LABELS');
    expect(cardSource).toContain('visibleProviders');
    expect(cardSource).toContain('activatedProviders');
    expect(cardSource).toContain('warningCount');
    expect(cardSource).toContain('lastSyncLabel');
    expect(cardSource).toContain('Details');
  });

  it('11 Kategorien im Dashboard sichtbar', () => {
    const categories = getConnectCategories();
    expect(categories).toHaveLength(11);
    const keys = categories.map((item) => item.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'billing',
        'accounting',
        'ti_kim',
        'payments',
        'communication_channels',
        'routes_gps',
        'documents_signatures',
        'medical_data',
        'hr_payroll',
        'academy_integrations',
        'marketplace',
      ]),
    );
    for (const category of categories) {
      const stats = getCategoryDashboardStats(category, []);
      expect(stats.totalProviders).toBeGreaterThan(0);
      expect(stats.lastSyncLabel).toBe('Keine Synchronisation');
    }
  });

  it('Direktaufruf Configure-Route für Pflegekraft blockiert', () => {
    const decision = checkRoleAccess(
      '/business/connect/ti_kim/kim/configure',
      NURSE,
    );
    expect(decision.shouldRedirect).toBe(true);
  });

  it('Anbieter-Detailseite hat 9 Tabs', () => {
    const detailSource = fs.readFileSync(
      path.join(process.cwd(), 'src/screens/connect/ConnectIntegrationDetailScreen.tsx'),
      'utf8',
    );
    const tabs = [
      'Übersicht',
      'Funktionen',
      'Konfiguration',
      'Datenfreigaben',
      'Webhooks',
      'Synchronisation',
      'Audit',
      'Datenschutz',
      'Kosten',
    ];
    for (const tab of tabs) {
      expect(detailSource).toContain(tab);
    }
  });
});
