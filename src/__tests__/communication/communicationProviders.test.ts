import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  assertCommunicationSendAllowed,
  assertConsentRecordValid,
  assertPushDeliveryAllowed,
  clearCommunicationProviderAuditLog,
  createPlaceholderProviderConfig,
  getCommunicationProviderAuditLog,
  getCommunicationProviderConfigsForTenant,
  getPreparedChannelTemplates,
  listPreparedCommunicationProviderKeys,
  maskProviderCredentialReference,
  PREPARED_COMMUNICATION_PROVIDERS,
  prepareOutboundMessage,
  renderChannelTemplatePreview,
  sanitizeProviderConfigForRole,
  sendOutboundMessage,
} from '@/lib/communication';
import type {
  CommunicationConsentRecord,
  CommunicationProviderConfig,
  DevicePushTokenRecord,
  PrepareOutboundMessageInput,
} from '@/types/communication/channels';

const TENANT = DEMO_TENANT_ID;
const USER = 'user-comm-001';

function baseProvider(overrides: Partial<CommunicationProviderConfig> = {}): CommunicationProviderConfig {
  return {
    id: 'prov-1',
    tenantId: TENANT,
    providerKey: 'sendgrid',
    channel: 'transactional_email',
    displayName: 'SendGrid',
    status: 'prepared',
    credentialReference: 'vault/sendgrid/demo',
    sandboxMode: true,
    whatsappApproved: false,
    ...overrides,
  };
}

function baseConsent(overrides: Partial<CommunicationConsentRecord> = {}): CommunicationConsentRecord {
  return {
    tenantId: TENANT,
    recipientType: 'client',
    recipientId: 'client-1',
    channel: 'transactional_email',
    purpose: 'appointment_reminder',
    channelAllowed: true,
    purposeAllowed: true,
    recipientAllowed: true,
    healthDataAllowed: false,
    revokedAt: null,
    proofReference: 'consent-doc-001',
    proofRecordedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function baseInput(overrides: Partial<PrepareOutboundMessageInput> = {}): PrepareOutboundMessageInput {
  return {
    tenantId: TENANT,
    actorUserId: USER,
    channel: 'transactional_email',
    useCase: 'appointment_reminder',
    recipientType: 'client',
    recipientId: 'client-1',
    recipientAddress: 'client@example.com',
    bodyPreview: 'Terminerinnerung Demo',
    purpose: 'appointment_reminder',
    providerConfig: baseProvider(),
    consent: baseConsent(),
    ...overrides,
  };
}

describe('Communication Providers — consent guard', () => {
  it('blockiert Nachricht ohne Provider', () => {
    const result = assertCommunicationSendAllowed(baseInput({ providerConfig: null }));
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('missing_provider');
  });

  it('blockiert Nachricht ohne Consent', () => {
    const result = assertCommunicationSendAllowed(baseInput({ consent: null }));
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('missing_consent');
  });

  it('blockiert Gesundheitsdaten auf unsicherem Kanal', () => {
    const result = assertCommunicationSendAllowed(
      baseInput({
        channel: 'sms',
        providerConfig: baseProvider({ channel: 'sms', providerKey: 'twilio' }),
        consent: baseConsent({
          channel: 'sms',
          healthDataAllowed: true,
        }),
        containsHealthData: true,
      }),
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('health_data_insecure_channel');
  });

  it('blockiert WhatsApp ohne Freigabe', () => {
    const result = assertCommunicationSendAllowed(
      baseInput({
        channel: 'whatsapp_business',
        providerConfig: baseProvider({
          channel: 'whatsapp_business',
          providerKey: 'twilio',
          whatsappApproved: false,
        }),
        consent: baseConsent({ channel: 'whatsapp_business' }),
      }),
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('whatsapp_not_approved');
  });

  it('blockiert Push ohne Token/Consent', () => {
    const pushConsent = baseConsent({ channel: 'push' });
    const noToken = assertPushDeliveryAllowed(null, pushConsent);
    expect(noToken.allowed).toBe(false);
    if (!noToken.allowed) expect(noToken.code).toBe('push_no_token');

    const token: DevicePushTokenRecord = {
      tenantId: TENANT,
      userId: USER,
      deviceId: 'device-1',
      platform: 'ios',
      tokenHash: 'hash-abc',
      consentRecordedAt: null,
      revokedAt: null,
    };
    const noConsent = assertPushDeliveryAllowed(token, pushConsent);
    expect(noConsent.allowed).toBe(false);
    if (!noConsent.allowed) expect(noConsent.code).toBe('push_no_consent');
  });

  it('blockiert ohne Einwilligungsnachweis', () => {
    const result = assertConsentRecordValid(
      baseConsent({ proofReference: null, proofRecordedAt: null }),
      'transactional_email',
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('missing_proof');
  });
});

describe('Communication Providers — prepare service', () => {
  beforeEach(() => {
    clearCommunicationProviderAuditLog();
  });

  it('bereitet Vorlage nur vor, ohne Versand', () => {
    const templates = getPreparedChannelTemplates(TENANT);
    const template = templates.find((t) => t.useCase === 'appointment_reminder');
    expect(template).toBeDefined();
    const preview = renderChannelTemplatePreview(template!, {
      recipient_name: 'Max',
      appointment_date: '20.06.2026',
      appointment_time: '10:00',
    });
    expect(preview.preparedOnly).toBe(true);
    expect(preview.body).toContain('Max');
    expect(preview.body).not.toContain('{{recipient_name}}');
  });

  it('schreibt Audit-Ereignis bei blockierter Nachricht', async () => {
    const result = await prepareOutboundMessage(baseInput({ providerConfig: null }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('blocked');
    expect(getCommunicationProviderAuditLog().length).toBeGreaterThan(0);
    expect(getCommunicationProviderAuditLog()[0]?.blocked).toBe(true);
  });

  it('blockiert sendOutboundMessage dauerhaft', async () => {
    const result = await sendOutboundMessage('msg-001');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sent).toBe(false);
    expect(result.data.blocked).toBe(true);
  });

  it('normale Nutzer sehen keine Provider-Secrets', () => {
    const config = createPlaceholderProviderConfig(TENANT, PREPARED_COMMUNICATION_PROVIDERS[0]!);
    config.credentialReference = 'vault/sendgrid/tenant-abc';
    const adminView = sanitizeProviderConfigForRole(config, true);
    const userView = sanitizeProviderConfigForRole(config, false);
    expect(adminView.credentialReference).toContain('••••');
    expect(userView.credentialReference).toBeNull();
    expect(getCommunicationProviderConfigsForTenant(TENANT, false)[0]?.credentialReference).toBeNull();
  });
});

describe('Communication Providers — registry', () => {
  it('listet vorbereitete Provider', () => {
    const keys = listPreparedCommunicationProviderKeys();
    expect(keys).toContain('sendgrid');
    expect(keys).toContain('twilio');
    expect(keys).toContain('firebase_fcm');
    expect(keys).toContain('sip_generic');
  });

  it('maskiert Credential-Referenzen', () => {
    expect(maskProviderCredentialReference('vault/sendgrid/tenant-abc')).toContain('••••');
    expect(maskProviderCredentialReference('vault/sendgrid/tenant-abc')).not.toContain('tenant-abc');
  });
});

describe('0046_communication_providers_prepared migration', () => {
  const sql = readFileSync(
    path.join(process.cwd(), 'supabase/migrations/0046_communication_providers_prepared.sql'),
    'utf8',
  );

  it('legt alle acht Kommunikations-Tabellen an', () => {
    for (const table of [
      'communication_provider_configs',
      'communication_channel_templates',
      'communication_consents',
      'communication_outbound_messages',
      'communication_delivery_events',
      'communication_provider_audit_events',
      'device_push_tokens',
      'phone_call_logs',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
  });

  it('speichert keine Klartext-Secrets', () => {
    expect(sql).toContain('credential_reference');
    expect(sql).not.toMatch(/api_key\s+TEXT/i);
    expect(sql).toContain('token_hash');
    expect(sql).not.toMatch(/push_token\s+TEXT/i);
  });

  it('aktiviert RLS auf allen Tabellen', () => {
    for (const table of [
      'communication_provider_configs',
      'communication_channel_templates',
      'communication_consents',
      'communication_outbound_messages',
      'communication_delivery_events',
      'communication_provider_audit_events',
      'device_push_tokens',
      'phone_call_logs',
    ]) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
  });

  it('enthält keine destruktiven Befehle', () => {
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
  });
});
