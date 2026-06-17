import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROLE_PERMISSIONS } from '@/data/demo/permissions';
import { hasPermission } from '@/lib/permissions';
import {
  fetchTenantSettings,
  resetTenantSettingsStore,
  saveTenantSettings,
} from '@/lib/tenant/tenantSettingsService';
import { TENANT_SETTINGS_PERMISSION, TENANT_SETTINGS_ROUTE } from '@/lib/tenant/tenantSettingsRoute';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Mandanten-Bereich Navigation', () => {
  it('Route und Screen existieren', () => {
    expect(TENANT_SETTINGS_ROUTE).toBe('/settings/tenant');
    expect(existsSync(path.join(root, 'app/settings/tenant.tsx'))).toBe(true);
    expect(existsSync(path.join(root, 'app/settings/index.tsx'))).toBe(true);
    expect(existsSync(path.join(root, 'app/settings/_layout.tsx'))).toBe(true);
    expect(existsSync(path.join(root, 'src/screens/settings/TenantSettingsScreen.tsx'))).toBe(true);
  });

  it('Settings-Index leitet auf Mandanten-Route weiter', () => {
    const indexRoute = readSrc('app/settings/index.tsx');
    expect(indexRoute).toContain('Redirect');
    expect(indexRoute).toContain('TENANT_SETTINGS_ROUTE');
  });

  it('App-Route bindet TenantSettingsScreen', () => {
    expect(readSrc('app/settings/tenant.tsx')).toContain('TenantSettingsScreen');
  });

  it('Shell-Footer verlinken Mandanten-Bereich', () => {
    expect(readSrc('src/components/layout/DesktopShell.tsx')).toContain('TenantSettingsNavLink');
    expect(readSrc('src/components/layout/CareLightDesktopShell.tsx')).toContain('TenantSettingsNavLink');
    expect(readSrc('src/components/layout/TabletShell.tsx')).toContain('TenantSettingsNavLink');
    expect(readSrc('src/components/layout/TenantSettingsNavLink.tsx')).toContain('TENANT_SETTINGS_ROUTE');
  });

  it('NavLink prüft Mandanten-Admin-Berechtigung', () => {
    const navLink = readSrc('src/components/layout/TenantSettingsNavLink.tsx');
    expect(navLink).toContain('TENANT_SETTINGS_PERMISSION');
    expect(navLink).toContain('return null');
  });
});

describe('Mandanten-Bereich Berechtigungen', () => {
  it('business_admin darf Mandanten-Stammdaten verwalten', () => {
    expect(hasPermission('business_admin', TENANT_SETTINGS_PERMISSION)).toBe(true);
    expect(ROLE_PERMISSIONS.business_admin).toContain(TENANT_SETTINGS_PERMISSION);
  });

  it('business_manager darf Mandanten-Stammdaten nicht verwalten', () => {
    expect(hasPermission('business_manager', TENANT_SETTINGS_PERMISSION)).toBe(false);
  });

  it('Service blockiert ohne Berechtigung', async () => {
    resetTenantSettingsStore();
    const result = await fetchTenantSettings(DEMO_TENANT_ID, 'billing');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Berechtigung|Keine/i);
    }
  });
});

describe('Mandanten-Bereich Service (Demo)', () => {
  it('lädt und speichert Mandanten-Stammdaten im Demo-Modus', async () => {
    resetTenantSettingsStore();

    const loaded = await fetchTenantSettings(DEMO_TENANT_ID, 'business_admin');
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    expect(loaded.data.name).toBeTruthy();
    expect(loaded.data.city).toBeTruthy();

    const saved = await saveTenantSettings(
      DEMO_TENANT_ID,
      { ...loaded.data, name: 'Helferhasen+ Test' },
      'business_admin',
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.data.name).toBe('Helferhasen+ Test');
  });
});
