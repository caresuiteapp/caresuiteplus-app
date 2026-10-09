import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BusinessRegistrationInput } from '@/lib/auth/auth.types';
import { FREE_REGISTRATION_PRODUCTS } from '@/lib/auth/businessRegistrationPolicy';
import * as nativeService from '@/lib/auth/businessAuthService';
import * as webService from '@/lib/auth/businessAuthService.web';

const mocks = vi.hoisted(() => ({
  mode: 'supabase' as 'supabase' | 'demo',
  invoke: vi.fn(), signIn: vi.fn(), activate: vi.fn(), save: vi.fn(), setHash: vi.fn(),
}));
vi.mock('@/lib/platformConsole/platformRuntime', () => ({ refreshPlatformRuntime: vi.fn().mockResolvedValue({ status: 'ready', settings: { maintenanceMode: false, registrationEnabled: true, notice: '' } }) }));
vi.mock('@/lib/platformConsole/platformRuntime.web', () => ({ refreshPlatformRuntime: vi.fn().mockResolvedValue({ status: 'ready', settings: { maintenanceMode: false, registrationEnabled: true, notice: '' } }) }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => mocks.mode }));
vi.mock('@/lib/supabase/config', () => ({ isDemoMode: () => mocks.mode === 'demo' }));
vi.mock('@/lib/supabase/edgeFunctions', () => ({ invokeEdgeFunction: mocks.invoke }));
vi.mock('@/lib/supabase/authService', () => ({ signInWithPassword: mocks.signIn }));
vi.mock('@/lib/billing/moduleActivationService', () => ({ activateRegistrationModules: mocks.activate }));
vi.mock('@/lib/auth/accessStore', () => ({
  findTenantUserByUsername: vi.fn(), getPasswordHash: vi.fn(), getTenantUsers: () => [],
  listTenantUsernames: () => [], saveTenantUser: mocks.save, setPasswordHash: mocks.setHash,
}));
vi.mock('@/lib/auth/loginAuditService', () => ({ recordLoginAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/auth/passwordHash', () => ({ hashSecret: vi.fn().mockResolvedValue('hash'), verifySecret: vi.fn() }));

const input: BusinessRegistrationInput = {
  companyName: 'Care Beispiel UG', legalForm: 'UG', industry: 'Alltagsbegleitung',
  street: 'Beispielstraße 1', zip: '10115', city: 'Berlin', phone: '+49 30 123456',
  email: 'unternehmen@example.de', contactFirstName: 'Ada', contactLastName: 'Beispiel',
  contactRole: 'Geschäftsführerin', adminFirstName: 'Ada', adminLastName: 'Beispiel',
  adminEmail: 'ada@example.de', adminPassword: 'EinPasswort123!', selectedModules: ['assist'], termsAccepted: true,
};
const response = {
  ok: true,
  data: {
    tenantId: 'tenant-1',
    owner: { id: 'owner-1', tenantId: 'tenant-1', username: 'care.ada.beisp', roleKey: 'owner', email: 'ada@example.de', displayName: 'Ada Beispiel' },
    credentials: { username: 'care.ada.beisp' },
  },
};
beforeEach(() => {
  vi.clearAllMocks(); mocks.mode = 'supabase'; mocks.invoke.mockResolvedValue(response);
});

describe.each([['native', nativeService], ['web', webService]] as const)('%s business registration contract', (_platform, service) => {
  it('submits the current normalized catalogue and consent without a module choice or implicit login', async () => {
    const result = await service.registerBusinessTenant(input);
    expect(mocks.invoke).toHaveBeenCalledOnce();
    const [name, request] = mocks.invoke.mock.calls[0];
    expect(name).toBe('register-business-tenant');
    expect(request).toMatchObject({
      legalForm: 'UG (haftungsbeschränkt)', industry: 'Ambulante Alltagsbegleitung', contactRole: 'Geschäftsführung',
      termsAccepted: true, adminEmail: input.adminEmail, adminPassword: input.adminPassword,
    });
    expect(request.registrationCatalogVersion).toBeTruthy();
    expect(request.legalFormKey).toBe('ug');
    expect(request.industryKey).toBe('alltagsbegleitung');
    expect(JSON.parse(JSON.stringify(request))).not.toHaveProperty('selectedModules');
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.owner.email).toBe(input.adminEmail);
      expect(result.data.owner.authUserId).toBeNull();
    }
  });

  it('returns a failed provision without reporting success or authenticating', async () => {
    mocks.invoke.mockResolvedValue({ ok: false, error: 'E-Mail bereits registriert.' });
    expect(await service.registerBusinessTenant(input)).toEqual({ ok: false, error: 'E-Mail bereits registriert.' });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it('rejects invalid catalogue entries before submitting account data', async () => {
    const result = await service.registerBusinessTenant({ ...input, industry: 'Unbekannt' });
    expect(result.ok).toBe(false);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('grants every free area in demo mode even if an older caller supplied a selection', async () => {
    mocks.mode = 'demo';
    const result = await service.registerBusinessTenant(input);
    expect(result.ok).toBe(true);
    expect(mocks.activate).toHaveBeenCalledWith(expect.any(String), FREE_REGISTRATION_PRODUCTS);
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it('preserves the entered password for the separate explicit login', async () => {
    mocks.signIn.mockResolvedValue({ ok: false, error: 'Ungültiges Passwort.' });
    await service.loginBusinessUser(' ADA@example.de ', ' Passwort mit Leerzeichen ');
    expect(mocks.signIn).toHaveBeenCalledWith('ada@example.de', ' Passwort mit Leerzeichen ');
  });
});
