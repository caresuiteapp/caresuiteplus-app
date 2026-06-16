import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { resetDemoAccessStore } from '@/lib/auth/demoAccessStore';
import {
  registerBusinessTenant,
  loginBusinessUser,
  generateInternalUserAccess,
} from '@/lib/auth/businessAuthService';
import {
  generateEmployeeAccess,
  loginEmployeePortal,
  blockEmployeeAccess,
  resetEmployeePassword,
} from '@/lib/auth/employeePortalAuthService';
import {
  generateClientPortalCode,
  validatePortalCodeLogin,
  blockPortalCode,
  regeneratePortalCode,
} from '@/lib/auth/clientPortalAuthService';
import {
  billingCanViewInvoices,
  employeeCanViewOnlyOwnAssignments,
  pdlCanViewCareDocumentation,
  roleHasPermission,
} from '@/lib/auth/permissionService';
import { activatePurchasedModule, resetModuleAccessStore } from '@/lib/modules';
import { getServiceMode } from '@/lib/services/mode';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';

vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe('authAccessModel', () => {
  beforeEach(() => {
    resetDemoAccessStore();
    resetModuleAccessStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('registers a business tenant and activates office', async () => {
    const result = await registerBusinessTenant({
      companyName: 'Helferhasen+ UG',
      legalForm: 'UG',
      industry: 'Betreuung',
      street: 'Test 1',
      zip: '10115',
      city: 'Berlin',
      phone: '+49 30 123',
      email: 'info@helferhasen.app',
      contactFirstName: 'Kevin',
      contactLastName: 'Reinhardt',
      contactRole: 'GF',
      adminFirstName: 'Kevin',
      adminLastName: 'Reinhardt',
      adminEmail: 'kevin@helferhasen.app',
      adminPassword: 'SecurePass1',
      selectedModules: ['assist'],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.owner.username).toBe('helfe.kevi.reinhar');
      expect(result.data.owner.roleKey).toBe('owner');
    }
  });

  it('generates usernames for internal users and employee portal accounts', async () => {
    const internal = await generateInternalUserAccess({
      tenantId: DEMO_TENANT_ID,
      companyName: 'Pflege Müller GmbH',
      firstName: 'Maria',
      lastName: 'Schmidt',
      email: 'maria@pflege-mueller.app',
      roleKey: 'billing',
      createdBy: null,
    });
    const employee = await generateEmployeeAccess({
      tenantId: DEMO_TENANT_ID,
      companyName: 'Pflege Müller GmbH',
      employeeId: 'emp-001',
      firstName: 'Tom',
      lastName: 'Weber',
      createdBy: null,
    });

    expect(internal.ok).toBe(true);
    if (internal.ok) {
      expect(internal.data.user.username).toBe('pfle.mari.schmid');
    }
    expect(employee.ok).toBe(true);
    if (employee.ok) {
      expect(employee.data.account.username.length).toBeLessThanOrEqual(20);
    }
  });

  it('blocks employee login', async () => {
    const created = await generateEmployeeAccess({
      tenantId: DEMO_TENANT_ID,
      companyName: 'Demo',
      employeeId: 'emp-block',
      firstName: 'Blocked',
      lastName: 'User',
      createdBy: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await blockEmployeeAccess(created.data.account.id, null, 'Test');
    const login = await loginEmployeePortal(created.data.account.username, created.data.credentials.oneTimePassword!);
    expect(login.ok).toBe(false);
    if (!login.ok) {
      expect(login.error).toMatch(/gesperrt/);
    }
  });

  it('resets employee password with a new one-time password', async () => {
    const created = await generateEmployeeAccess({
      tenantId: DEMO_TENANT_ID,
      companyName: 'Demo',
      employeeId: 'emp-reset',
      firstName: 'Reset',
      lastName: 'User',
      createdBy: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const reset = await resetEmployeePassword(created.data.account.id, null);
    expect(reset.ok).toBe(true);
    if (reset.ok) {
      expect(reset.data.oneTimePassword).toBeTruthy();
    }
  });

  it('accepts active client portal codes and rejects blocked codes', async () => {
    const created = await generateClientPortalCode({
      tenantId: DEMO_TENANT_ID,
      clientId: 'client-001',
      createdBy: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const login = await validatePortalCodeLogin(created.data.credentials.portalCode!, 'client');
    expect(login.ok).toBe(true);

    await blockPortalCode(created.data.code.id, null, 'Test');
    const blockedLogin = await validatePortalCodeLogin(created.data.credentials.portalCode!, 'client');
    expect(blockedLogin.ok).toBe(false);
  });

  it('invalidates old portal code after regeneration', async () => {
    const created = await generateClientPortalCode({
      tenantId: DEMO_TENANT_ID,
      clientId: 'client-002',
      createdBy: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const oldCode = created.data.credentials.portalCode!;
    const regenerated = await regeneratePortalCode(created.data.code.id, 'client');
    expect(regenerated.ok).toBe(true);

    const oldLogin = await validatePortalCodeLogin(oldCode, 'client');
    expect(oldLogin.ok).toBe(false);
  });

  it('applies role permission examples', () => {
    expect(billingCanViewInvoices('billing')).toBe(true);
    expect(pdlCanViewCareDocumentation('pdl')).toBe(true);
    expect(pdlCanViewCareDocumentation('billing')).toBe(false);
    expect(employeeCanViewOnlyOwnAssignments('employee')).toBe(true);
    expect(roleHasPermission('billing', 'office.invoices.view')).toBe(true);
  });

  it('blocks unknown business login', async () => {
    const login = await loginBusinessUser('unknown.user', 'WrongPass1');
    expect(login.ok).toBe(false);
  });

  it('uses demo tenant in demo mode', () => {
    expect(getServiceMode()).toBe('demo');
    expect(assertTenantForMode(DEMO_TENANT_ID)).toBeNull();
    expect(assertTenantForMode('other-tenant')).toEqual({
      ok: false,
      error: 'Mandant nicht gefunden.',
    });
  });

  it('does not restrict tenant id in live service mode', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    expect(getServiceMode()).toBe('supabase');
    expect(assertTenantForMode(DEMO_TENANT_ID)?.error).toContain('Demo');
    expect(assertTenantForMode('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBeNull();
  });
});
