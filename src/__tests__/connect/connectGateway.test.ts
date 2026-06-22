import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  assertConnectActionAllowed,
  buildConnectExecutionContext,
  clearPreparedConnectAuditLog,
  executeConnectAction,
  getPreparedConnectAuditLog,
  listPreparedProviderKeys,
  maskConnectCredentialReference,
} from '@/lib/connect/gateway';
import { isConnectDisplayedAsConnected } from '@/types/connect/gateway';

const ADMIN = 'business_admin' as const;
const TENANT = DEMO_TENANT_ID;
const USER = 'user-001';

function baseInput(overrides: Partial<Parameters<typeof buildConnectExecutionContext>[0]> = {}) {
  return {
    tenantId: TENANT,
    userId: USER,
    role: ADMIN,
    providerKey: 'stripe',
    category: 'payments' as const,
    integrationId: 'int-001',
    integrationStatus: 'configured' as const,
    connectorStatus: 'sandbox_ready' as const,
    hasCredentialReference: true,
    allowedActions: ['test_connection', 'payment_collection'],
    permissions: ['connect.configure' as const, 'office.clients.view_sensitive' as const],
    environment: 'sandbox' as const,
    ...overrides,
  };
}

describe('Connect Gateway — assertConnectActionAllowed', () => {
  beforeEach(() => {
    clearPreparedConnectAuditLog();
    vi.stubGlobal('__DEV__', false);
  });

  it('blockiert Aktion ohne Tenant', () => {
    const ctx = buildConnectExecutionContext(baseInput({ tenantId: null }));
    expect(ctx).toBeNull();
  });

  it('blockiert Aktion ohne Rolle', () => {
    const ctx = buildConnectExecutionContext(baseInput({ role: null }));
    expect(ctx).toBeNull();
  });

  it('blockiert ohne Integration', () => {
    const ctx = buildConnectExecutionContext(baseInput())!;
    const result = assertConnectActionAllowed('test_connection', { ...ctx, integrationId: null });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('missing_integration');
  });

  it('blockiert coming_soon Provider', () => {
    const ctx = buildConnectExecutionContext(
      baseInput({ connectorStatus: 'coming_soon' }),
    )!;
    const result = assertConnectActionAllowed('test_connection', ctx);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('provider_coming_soon');
  });

  it('blockiert disabled Integration', () => {
    const ctx = buildConnectExecutionContext(
      baseInput({ integrationStatus: 'disabled' }),
    )!;
    const result = assertConnectActionAllowed('test_connection', ctx);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('integration_disabled');
  });

  it('blockiert Production + Mock Adapter', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-key');
    const ctx = buildConnectExecutionContext(
      baseInput({ environment: 'production' }),
    )!;
    const result = assertConnectActionAllowed('test_connection', {
      ...ctx,
      demoMode: false,
      isMockAdapter: true,
      environment: 'production',
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('production_mock_adapter');
  });

  it('blockiert Production + demoMode', () => {
    const ctx = buildConnectExecutionContext(baseInput({ environment: 'production' }))!;
    const result = assertConnectActionAllowed('test_connection', { ...ctx, demoMode: true });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('production_in_demo_mode');
  });

  it('blockiert nicht erlaubte Aktion', () => {
    const ctx = buildConnectExecutionContext(baseInput())!;
    const result = assertConnectActionAllowed('unknown_action', ctx);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('action_not_allowed');
  });

  it('blockiert fehlende Credential-Referenz in Production/Sandbox', () => {
    const ctx = buildConnectExecutionContext(
      baseInput({ hasCredentialReference: false, environment: 'sandbox' }),
    )!;
    const result = assertConnectActionAllowed('test_connection', ctx);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('missing_credential');
  });
});

describe('Connect Gateway — execute & audit', () => {
  beforeEach(() => {
    clearPreparedConnectAuditLog();
  });

  it('erzeugt Audit-Eintrag bei blockierter Aktion', async () => {
    const ctx = buildConnectExecutionContext(baseInput({ integrationId: null }))!;
    // build returns null for missing fields — use partial context for execute path
    const fullCtx = buildConnectExecutionContext(baseInput())!;
    const result = await executeConnectAction('payment_collection', {}, {
      ...fullCtx,
      integrationId: null,
    });
    expect(result.blocked).toBe(true);
    expect(getPreparedConnectAuditLog().length).toBeGreaterThan(0);
  });

  it('Demo-Umgebung liefert gekennzeichnete Demo-Antwort', async () => {
    const ctx = buildConnectExecutionContext(
      baseInput({ environment: 'demo' }),
    )!;
    const result = await executeConnectAction('test_connection', {}, ctx);
    expect(result.demo).toBe(true);
    expect(result.message).toContain('Demo');
  });

  it('zeigt not_configured nicht als verbunden', () => {
    expect(isConnectDisplayedAsConnected('not_configured', 'production_ready')).toBe(false);
    expect(isConnectDisplayedAsConnected('production', 'production_ready')).toBe(true);
  });
});

describe('Connect Gateway — Client & Secrets', () => {
  it('maskiert Credential-Referenzen für Admin-UI', () => {
    expect(maskConnectCredentialReference(null)).toBe('Nicht konfiguriert');
    expect(maskConnectCredentialReference('vault/stripe/tenant-abc')).toContain('••••');
    expect(maskConnectCredentialReference('vault/stripe/tenant-abc')).not.toContain('tenant-abc');
  });

  it('enthält keine API-Key-Literale in Gateway-Lib', () => {
    const gatewayDir = path.join(process.cwd(), 'src/lib/connect/gateway');
    const walk = (dir: string): string[] => {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : entry.name.endsWith('.ts') ? [full] : [];
      });
    };
    const contents = walk(gatewayDir).map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(contents).not.toMatch(/sk_live_|sk_test_|SUPABASE_SERVICE_ROLE/);
  });

  it('listet vorbereitete Provider-Keys', () => {
    expect(listPreparedProviderKeys()).toContain('stripe');
    expect(listPreparedProviderKeys()).toContain('datev');
  });
});

describe('Connect Gateway — invoke (demo path)', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
    clearPreparedConnectAuditLog();
  });

  it('nutzt lokalen Gateway im Demo-Modus ohne Edge-Aufruf', async () => {
    const ctx = buildConnectExecutionContext(baseInput({ environment: 'demo' }));
    expect(ctx?.environment).toBe('demo');
    const result = await executeConnectAction('test_connection', {}, ctx!);
    expect(result.demo).toBe(true);
  });
});
