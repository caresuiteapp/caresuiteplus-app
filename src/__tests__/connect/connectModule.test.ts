import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { getPermissionsForRole } from '@/lib/permissions/staticRolePermissions';
import {
  getAllConnectIntegrations,
  getConnectCategories,
  getConnectCategory,
  getVisibleConnectIntegrations,
  isConnectIntegrationExecutable,
} from '@/lib/connect';
import {
  isModuleScopeNavigable,
  isModuleScopeVisible,
  resolveModuleNavState,
  resolveModuleScopeFromPath,
} from '@/lib/modules';
import { checkRoleAccess } from '@/lib/navigation';

const ADMIN = 'business_admin' as const;
const MANAGER = 'business_manager' as const;
const NURSE = 'nurse' as const;
const TENANT = DEMO_TENANT_ID;

function readConnectLibFiles(): string {
  const dir = path.join(process.cwd(), 'src/lib/connect');
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => fs.readFileSync(path.join(dir, file), 'utf8'))
    .join('\n');
}

describe('Connect module', () => {
  it('connect ist für Admin sichtbar und navigierbar (beta)', () => {
    const state = resolveModuleNavState('connect', { tenantId: TENANT, roleKey: ADMIN });
    expect(state.effectiveStatus).toBe('beta');
    expect(state.isVisible).toBe(true);
    expect(state.isNavigable).toBe(true);
    expect(isModuleScopeVisible('connect', { tenantId: TENANT, roleKey: ADMIN })).toBe(true);
    expect(isModuleScopeNavigable('connect', { tenantId: TENANT, roleKey: ADMIN })).toBe(true);
  });

  it('connect.configure nur für business_admin', () => {
    expect(getPermissionsForRole(ADMIN)).toContain('connect.configure');
    expect(getPermissionsForRole(MANAGER)).toContain('connect.view');
    expect(getPermissionsForRole(MANAGER)).not.toContain('connect.configure');
    expect(getPermissionsForRole(NURSE)).not.toContain('connect.view');
  });

  it('coming_soon Integrationen sind nicht ausführbar', () => {
    const comingSoon = getAllConnectIntegrations().filter((item) => item.readiness === 'coming_soon');
    expect(comingSoon.length).toBeGreaterThan(0);
    for (const integration of comingSoon) {
      expect(isConnectIntegrationExecutable(integration)).toBe(false);
    }
  });

  it('disabled Integrationen erscheinen nicht in sichtbarer Liste', () => {
    for (const category of getConnectCategories()) {
      const visibleKeys = getVisibleConnectIntegrations(category).map((item) => item.key);
      for (const integration of category.integrations) {
        if (integration.readiness === 'disabled') {
          expect(visibleKeys).not.toContain(integration.key);
        }
      }
    }
  });

  it('Direkt-Route /business/connect/providers ist für Pflegekraft blockiert', () => {
    const decision = checkRoleAccess('/business/connect/providers', NURSE);
    expect(decision.shouldRedirect).toBe(true);
    expect(decision.reason).toBe('wrong_role');
  });

  it('resolveModuleScopeFromPath mappt /business/connect', () => {
    expect(resolveModuleScopeFromPath('/business/connect')).toBe('connect');
    expect(resolveModuleScopeFromPath('/business/connect/billing')).toBe('connect');
    expect(resolveModuleScopeFromPath('/business/connect/providers')).toBe('connect');
  });

  it('keine API-Key-Strings in Connect-Lib-Dateien', () => {
    const source = readConnectLibFiles();
    expect(source).not.toMatch(/sk_live/i);
    expect(source).not.toMatch(/pk_live/i);
    expect(source).not.toMatch(/api_key/i);
    expect(source).not.toMatch(/secret_key/i);
    expect(source).not.toMatch(/service_role/i);
  });

  it('isConnectIntegrationExecutable ist für alle Integrationen false', () => {
    for (const integration of getAllConnectIntegrations()) {
      expect(isConnectIntegrationExecutable(integration)).toBe(false);
    }
  });

  it('Connect-Katalog enthält 11 Kategorien', () => {
    expect(getConnectCategories()).toHaveLength(11);
    expect(getConnectCategory('billing')?.integrations.length).toBeGreaterThan(0);
    expect(getConnectCategory('marketplace')?.readiness).toBe('coming_soon');
  });
});
