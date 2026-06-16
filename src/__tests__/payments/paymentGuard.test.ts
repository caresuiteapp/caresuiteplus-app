import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  assertPaymentActionAllowed,
  containsPaymentSecretLiteral,
  maskPaymentCredentialReference,
} from '@/lib/payments/paymentGuard';

const root = path.join(__dirname, '..', '..', '..');
const migrationPath = path.join(root, 'supabase/migrations/0046_payment_providers.sql');

describe('0046_payment_providers migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('legt alle acht Zahlungstabellen an', () => {
    const tables = [
      'payment_provider_configs',
      'payment_customers',
      'payment_methods',
      'payment_mandates',
      'payment_transactions',
      'payment_webhook_events',
      'payment_reconciliation_events',
      'subscription_billing_events',
    ];
    for (const table of tables) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
  });

  it('speichert keine Klartext-API-Keys', () => {
    expect(sql).toContain('api_credential_reference');
    expect(sql).toContain('webhook_secret_reference');
    expect(sql).not.toMatch(/api_key\s+TEXT/i);
    expect(sql).toContain('provider_confirmed_paid');
  });

  it('aktiviert RLS auf allen Zahlungstabellen', () => {
    const tables = [
      'payment_provider_configs',
      'payment_customers',
      'payment_methods',
      'payment_mandates',
      'payment_transactions',
      'payment_webhook_events',
      'payment_reconciliation_events',
      'subscription_billing_events',
    ];
    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
  });

  it('mandantenspezifische Tabellen referenzieren tenant_id', () => {
    for (const table of [
      'payment_provider_configs',
      'payment_customers',
      'payment_methods',
      'payment_mandates',
      'payment_transactions',
      'payment_reconciliation_events',
      'subscription_billing_events',
    ]) {
      expect(sql).toMatch(
        new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}[\\s\\S]*tenant_id`, 'm'),
      );
    }
  });

  it('enthält keine destruktiven Befehle', () => {
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });
});

describe('Payment Guard', () => {
  it('blockiert Zahlung ohne Provider', () => {
    const result = assertPaymentActionAllowed({
      tenantId: DEMO_TENANT_ID,
      providerKey: 'none',
      providerActive: false,
      environment: 'sandbox',
      isMockProvider: true,
      demoMode: true,
      hasCredentialReference: false,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('missing_provider');
  });

  it('blockiert Production mit Mock-Provider', () => {
    const result = assertPaymentActionAllowed({
      tenantId: DEMO_TENANT_ID,
      providerKey: 'stripe',
      providerActive: true,
      environment: 'production',
      isMockProvider: true,
      demoMode: false,
      hasCredentialReference: true,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('production_mock_blocked');
  });

  it('maskiert Credential-Referenzen', () => {
    expect(maskPaymentCredentialReference('vault/stripe/tenant-abc')).not.toContain('tenant-abc');
    expect(maskPaymentCredentialReference(null)).toBe('Nicht konfiguriert');
  });

  it('erkennt Secret-Literale', () => {
    expect(containsPaymentSecretLiteral('sk_live_abc')).toBe(true);
    expect(containsPaymentSecretLiteral('normal-code')).toBe(false);
  });
});

describe('Payment Guard — Tenant-Isolation', () => {
  it('blockiert ohne Mandant', () => {
    const result = assertPaymentActionAllowed({
      tenantId: null,
      providerKey: 'stripe',
      providerActive: true,
      environment: 'sandbox',
      isMockProvider: true,
      demoMode: true,
      hasCredentialReference: true,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('missing_tenant');
  });
});

describe('Payment Lib — keine Secrets im Client', () => {
  it('enthält keine API-Key-Literale in payments-Lib', () => {
    const paymentsDir = path.join(root, 'src/lib/payments');
    const files = ['paymentProviderService.ts', 'paymentTransactionService.ts', 'paymentWebhookGuard.ts'];
    const contents = files
      .map((f) => readFileSync(path.join(paymentsDir, f), 'utf8'))
      .join('\n');
    expect(contents).not.toMatch(/sk_live_[a-zA-Z0-9]|sk_test_[a-zA-Z0-9]/);
  });
});
