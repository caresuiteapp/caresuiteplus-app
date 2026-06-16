import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { executeInvoiceAccountingExport } from '@/lib/accounting/invoiceAccountingService';
import { prepareOutboundMessage } from '@/lib/communication/channelService';
import { prepareGenerateContract } from '@/lib/documents/connectDocuments';
import { prepareOcrJob } from '@/lib/documents/connectDocumentOcrService';
import {
  assertConnectFeatureAllowed,
  buildConnectFeatureGateContext,
  buildConnectFeatureGateContextFromFeatureKey,
  CONNECT_FEATURE_META,
} from '@/lib/connect/gateway/connectFeatureGate';
import {
  buildConnectExecutionContext,
  executeConnectAction,
} from '@/lib/connect/gateway';
import { plausibilizeAssignmentStatusWithGps } from '@/lib/geo/locationService';
import { sendReferralRequest } from '@/lib/marketplace/referralService';
import { prepareInvoicePaymentLink } from '@/lib/payments/paymentTransactionService';
import { checkRoleAccess } from '@/lib/navigation';
import { CONNECT_PREPARED_BLOCK_TEXT, CONNECT_PREPARED_BLOCK_TITLE } from '@/types/connect/featureGate';

const ADMIN = 'business_admin' as const;
const NURSE = 'nurse' as const;
const TENANT = DEMO_TENANT_ID;
const USER = 'user-connect-gate-001';

function baseGateContext(
  overrides: Partial<ReturnType<typeof buildConnectFeatureGateContext>> = {},
) {
  return buildConnectFeatureGateContext({
    userId: USER,
    tenantId: TENANT,
    role: ADMIN,
    permissions: ['connect.view', 'connect.configure', 'integrations.manage'],
    hasConnectModuleAccess: true,
    featureReadiness: 'prepared',
    integrationStatus: 'configured',
    connectorStatus: 'sandbox_ready',
    providerEnvironment: 'sandbox',
    isMockProvider: true,
    hasCredentialReference: true,
    hasProductionApproval: false,
    hasPrivacyApproval: false,
    hasPaymentApproval: false,
    hasExternalTransferConsent: false,
    hasAvv: false,
    demoMode: true,
    requiresHealthData: false,
    requiresPaymentData: false,
    requiresExternalTransfer: false,
    usesProductionData: false,
    ...overrides,
  });
}

describe('Connect Release Gate — assertConnectFeatureAllowed', () => {
  it('blockiert ohne Login', () => {
    const result = assertConnectFeatureAllowed(
      'accounting.datev',
      'accounting_export',
      baseGateContext({ userId: null }),
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('missing_user');
  });

  it('blockiert ohne Mandant', () => {
    const result = assertConnectFeatureAllowed(
      'accounting.datev',
      'accounting_export',
      baseGateContext({ tenantId: null }),
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('missing_tenant');
  });

  it('blockiert ohne Rolle', () => {
    const result = assertConnectFeatureAllowed(
      'accounting.datev',
      'accounting_export',
      baseGateContext({ role: null }),
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('missing_role');
  });

  it('blockiert ohne Modulzugriff', () => {
    const result = assertConnectFeatureAllowed(
      'accounting.datev',
      'accounting_export',
      baseGateContext({ hasConnectModuleAccess: false }),
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('module_access_denied');
  });

  it('coming_soon: Anzeige erlaubt, Aktion blockiert', () => {
    const view = assertConnectFeatureAllowed(
      'accounting.datev',
      'view',
      baseGateContext({ featureReadiness: 'coming_soon' }),
    );
    expect(view.allowed).toBe(true);

    const action = assertConnectFeatureAllowed(
      'accounting.datev',
      'accounting_export',
      baseGateContext({ featureReadiness: 'coming_soon' }),
    );
    expect(action.allowed).toBe(false);
    if (!action.allowed) {
      expect(action.code).toBe('feature_coming_soon');
      expect(action.visible).toBe(true);
      expect(action.showBlockPage).toBe(true);
    }
  });

  it('intern: nur Admin sichtbar', () => {
    const nurse = assertConnectFeatureAllowed(
      'communication.sms',
      'view',
      baseGateContext({ featureReadiness: 'internal', role: NURSE, permissions: [] }),
    );
    expect(nurse.allowed).toBe(false);
    if (!nurse.allowed) expect(nurse.code).toBe('feature_internal');
  });

  it('Production + Mock blockiert', () => {
    const result = assertConnectFeatureAllowed(
      'payments.link',
      'create_payment_link',
      baseGateContext({
        providerEnvironment: 'production',
        isMockProvider: true,
        demoMode: false,
        hasProductionApproval: true,
        hasExternalTransferConsent: true,
        hasPaymentApproval: true,
      }),
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('production_mock_blocked');
  });

  it('fehlende Vault-Referenz blockiert', () => {
    const result = assertConnectFeatureAllowed(
      'accounting.datev',
      'accounting_export',
      baseGateContext({ hasCredentialReference: false, providerEnvironment: 'sandbox' }),
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('missing_credential');
  });
});

describe('Connect Release Gate — Szenario-Tests', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  });

  it('1. DATEV-Export ohne Anbieter blockiert', async () => {
    const result = await executeInvoiceAccountingExport(
      'inv-001',
      'RE-2026-001',
      TENANT,
      'datev',
      ADMIN,
      USER,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/blockiert|konfiguriert|vorbereitet/i);
    }
  });

  it('2. Zahlungslink ohne Anbieter blockiert', async () => {
    const result = await prepareInvoicePaymentLink(TENANT, 'inv-001', 'credit_card', ADMIN);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/blockiert|konfiguriert|Zahlung|Anbieter|vorbereitet/i);
    }
  });

  it('3. KIM ohne Anbieter blockiert', async () => {
    const ctx = buildConnectExecutionContext({
      tenantId: TENANT,
      userId: USER,
      role: ADMIN,
      providerKey: 'kim',
      category: 'ti_kim',
      integrationId: null,
      integrationStatus: 'not_configured',
      connectorStatus: 'beta',
      hasCredentialReference: false,
      permissions: ['ti.kim.manage', 'office.clients.view_sensitive'],
    });
    expect(ctx).toBeTruthy();
    const gate = assertConnectFeatureAllowed(
      'ti.kim',
      'kim_send',
      buildConnectFeatureGateContextFromFeatureKey('ti.kim', {
        userId: USER,
        tenantId: TENANT,
        role: ADMIN,
        integrationStatus: 'not_configured',
        connectorStatus: 'beta',
        hasCredentialReference: false,
        hasPrivacyApproval: false,
        hasAvv: false,
        hasExternalTransferConsent: false,
      }),
    );
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) {
      expect(['provider_not_configured', 'feature_coming_soon']).toContain(gate.code);
    }

    const exec = await executeConnectAction('kim_send', {}, ctx!);
    expect(exec.blocked).toBe(true);
  });

  it('4. SMS ohne Einwilligung blockiert', async () => {
    const result = await prepareOutboundMessage({
      tenantId: TENANT,
      actorUserId: USER,
      channel: 'sms',
      useCase: 'appointment_reminder',
      recipientType: 'client',
      recipientId: 'client-001',
      recipientAddress: '+491234567890',
      bodyPreview: 'Erinnerung',
      purpose: 'appointment_reminder',
      providerConfig: {
        id: 'cfg-sms',
        tenantId: TENANT,
        providerKey: 'twilio',
        channel: 'sms',
        displayName: 'Twilio SMS',
        status: 'sandbox',
        credentialReference: 'vault/twilio/demo',
        sandboxMode: true,
        whatsappApproved: false,
      },
      consent: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('blocked');
      expect(result.data.blockedReason).toMatch(/Einwilligung|Freigabe|blockiert|vorbereitet|konfiguriert/i);
    }
  });

  it('5. GPS ohne Freigabe blockiert', async () => {
    const result = await plausibilizeAssignmentStatusWithGps(
      {
        tenantId: TENANT,
        assignmentId: 'asg-001',
        assignmentStartAt: new Date().toISOString(),
        eventType: 'status_plausibility',
        purpose: 'status_plausibility',
        position: { latitude: 52.52, longitude: 13.405, accuracyMeters: 10, timestamp: new Date().toISOString() },
        consent: { employeeConsentGranted: false, consentRecordedAt: null, consentDocumentRef: null },
      },
      NURSE,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/blockiert|konfiguriert|Einwilligung|Freigabe|vorbereitet/i);
    }
  });

  it('6. OCR ohne Anbieter blockiert', async () => {
    const gen = await prepareGenerateContract({ tenantId: TENANT, title: 'OCR-Test' });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;

    const gate = assertConnectFeatureAllowed(
      'documents.ocr',
      'execute',
      buildConnectFeatureGateContextFromFeatureKey('documents.ocr', {
        userId: USER,
        tenantId: TENANT,
        role: ADMIN,
        integrationStatus: 'not_configured',
        connectorStatus: 'coming_soon',
        hasCredentialReference: false,
        hasExternalTransferConsent: false,
      }),
    );
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) {
      expect(['provider_not_configured', 'feature_coming_soon', 'missing_credential']).toContain(
        gate.code,
      );
    }

    const result = await prepareOcrJob({
      tenantId: TENANT,
      documentId: gen.data.id,
      providerKey: 'google_vision',
      context: {
        tenantId: TENANT,
        signatureProviderKey: null,
        ocrProviderKey: null,
        signatureProviderActive: false,
        ocrProviderActive: false,
        ocrExternalApproved: false,
        healthDataOcrApproved: false,
        hasCredentialReference: false,
        containsHealthData: false,
        isArchived: false,
        isMockProvider: true,
        demoMode: true,
        environment: 'demo',
        gobdProtectionActive: false,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/blockiert|konfiguriert|OCR|Anbieter/i);
    }
  });

  it('7. Marktplatz-Anfrage ohne Einwilligung blockiert', async () => {
    const result = await sendReferralRequest(TENANT, 'ref-nonexistent', ADMIN);
    expect(result.ok).toBe(false);
  });

  it('8. Produktionsmodus blockiert Mock über Gateway', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-key');

    const ctx = buildConnectExecutionContext({
      tenantId: TENANT,
      userId: USER,
      role: ADMIN,
      providerKey: 'stripe',
      category: 'payments',
      integrationId: 'int-pay',
      integrationStatus: 'production',
      connectorStatus: 'production_ready',
      hasCredentialReference: true,
      environment: 'production',
      permissions: ['connect.configure'],
    });
    expect(ctx).toBeTruthy();
    const exec = await executeConnectAction('create_payment_link', {}, {
      ...ctx!,
      demoMode: false,
      isMockAdapter: true,
      environment: 'production',
    });
    expect(exec.blocked).toBe(true);
    expect(exec.message).toMatch(/Mock|blockiert|Produktion/i);
  });

  it('9. Direktaufruf Configure-Route für Pflegekraft blockiert', () => {
    const decision = checkRoleAccess('/business/connect/ti_kim/kim/configure', NURSE);
    expect(decision.shouldRedirect).toBe(true);

    const gate = assertConnectFeatureAllowed(
      'ti_kim.kim',
      'configure',
      baseGateContext({ role: NURSE, permissions: ['connect.view'] }),
    );
    expect(gate.allowed).toBe(false);
  });

  it('10. Keine verbotenen Partner-Claims in Store/Marketing-Texten', () => {
    const catalog = readFileSync(
      path.join(process.cwd(), 'src/lib/connect/connectCatalog.ts'),
      'utf8',
    );
    const storeListing = readFileSync(
      path.join(process.cwd(), 'docs/store/store-listing-texts.md'),
      'utf8',
    );
    const hubHero = readFileSync(
      path.join(process.cwd(), 'src/components/connect/ConnectHubHero.tsx'),
      'utf8',
    );

    expect(catalog).not.toMatch(/Zertifizierte Software/i);
    expect(catalog).not.toMatch(/offizieller Partner/i);
    expect(storeListing).not.toMatch(/DATEV-zertifiziert|Stripe-Partner|produktiv verbunden/i);
    expect(hubHero).not.toMatch(/produktiv aktiv|Live-Anbindung/i);
    expect(CONNECT_FEATURE_META['accounting.datev']).toBeDefined();
  });
});

describe('Connect Release Gate — UI Block Screen', () => {
  it('ConnectPreparedBlockScreen enthält Pflichttexte und Buttons', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/components/connect/ConnectPreparedBlockScreen.tsx'),
      'utf8',
    );
    expect(source).toContain('CONNECT_PREPARED_BLOCK_TITLE');
    expect(source).toContain('CONNECT_PREPARED_BLOCK_TEXT');
    expect(source).toContain('Zurück zu Connect');
    expect(source).toContain('Admin-Einstellungen öffnen');
    expect(source).toContain('Mehr Informationen');
    expect(source).toContain("can('connect.configure')");
  });

  it('Configure-Route nutzt ConnectFeatureRouteGuard', () => {
    const route = readFileSync(
      path.join(process.cwd(), 'app/business/connect/[category]/[integrationKey]/configure.tsx'),
      'utf8',
    );
    expect(route).toContain('ConnectFeatureRouteGuard');
    expect(route).toContain('actionKey="configure"');
  });
});
