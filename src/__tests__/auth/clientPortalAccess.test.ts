import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { resetAccessStore } from '@/lib/auth/accessStore';
import {
  generateClientPortalCode,
  loginClientPortal,
  regeneratePortalCode,
} from '@/lib/auth/clientPortalAuthService';
import {
  regenerateClientPortalAccessCode,
  setupClientPortalAccess,
} from '@/lib/clients/clientPortalAccessService';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe('client portal username + code access', () => {
  beforeEach(() => {
    resetAccessStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts username + code login and rejects wrong code', async () => {
    const created = await generateClientPortalCode({
      tenantId: DEMO_TENANT_ID,
      clientId: 'client-login-1',
      firstName: 'Heinz-Peter',
      lastName: 'Reinhardt',
      createdBy: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.data.credentials.username).toBe('hreinhardt');
    expect(created.data.credentials.portalCode).toHaveLength(6);

    const login = await loginClientPortal(
      created.data.credentials.username!,
      created.data.credentials.portalCode!,
    );
    expect(login.ok).toBe(true);

    const badLogin = await loginClientPortal(
      created.data.credentials.username!,
      '000000',
    );
    expect(badLogin.ok).toBe(false);
  });

  it('invalidates old code after regeneration', async () => {
    const created = await generateClientPortalCode({
      tenantId: DEMO_TENANT_ID,
      clientId: 'client-login-2',
      firstName: 'Heinz-Peter',
      lastName: 'Reinhardt',
      createdBy: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const oldCode = created.data.credentials.portalCode!;
    const regenerated = await regeneratePortalCode(created.data.code.id, 'client', 'Heinz-Peter', 'Reinhardt');
    expect(regenerated.ok).toBe(true);
    if (!regenerated.ok) return;

    const oldLogin = await loginClientPortal(created.data.credentials.username!, oldCode);
    expect(oldLogin.ok).toBe(false);

    const newLogin = await loginClientPortal(
      regenerated.data.username!,
      regenerated.data.portalCode!,
    );
    expect(newLogin.ok).toBe(true);
  });

  it('setup and regenerate via office service', async () => {
    const setup = await setupClientPortalAccess({
      tenantId: DEMO_TENANT_ID,
      clientId: 'client-001',
      firstName: 'Heinz-Peter',
      lastName: 'Reinhardt',
    });
    expect(setup.ok).toBe(true);
    if (!setup.ok) return;

    expect(setup.data.credentials.username).toBe('hreinhardt');
    expect(setup.data.credentials.accessCode).toMatch(/^[A-Z0-9]{6}$/);

    const login = await loginClientPortal(
      setup.data.credentials.username,
      setup.data.credentials.accessCode,
    );
    expect(login.ok).toBe(true);

    const rotated = await regenerateClientPortalAccessCode({
      tenantId: DEMO_TENANT_ID,
      clientId: 'client-001',
      accessId: setup.data.access.id,
    });
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;

    const oldLogin = await loginClientPortal(
      setup.data.credentials.username,
      setup.data.credentials.accessCode,
    );
    expect(oldLogin.ok).toBe(false);

    const newLogin = await loginClientPortal(
      rotated.data.credentials.username,
      rotated.data.credentials.accessCode,
    );
    expect(newLogin.ok).toBe(true);
  });

  it('portal tab has no demo invitation UI in production-facing panel', () => {
    const panel = readFileSync(
      path.join(process.cwd(), 'src/components/clients/ClientPortalAccessPanel.tsx'),
      'utf8',
    );
    expect(panel).not.toContain('Portal einladen');
    expect(panel).not.toContain('Einladung senden');
    expect(panel).not.toMatch(/\bDemo\b/);
    expect(panel).toContain('Portal-Zugang einrichten');
    expect(panel).toContain('Neuen Code erzeugen');
    expect(panel).toContain('ClientModuleAssignmentPanel');
    expect(panel).toContain('saveClientModuleAssignments');
    expect(panel).toContain('Anmeldung Klient:innen Portal');
    expect(panel).toContain('Beide kopieren');
    expect(panel).toContain('GlassCard');
    expect(panel).not.toContain('Angehörige');
  });
});
