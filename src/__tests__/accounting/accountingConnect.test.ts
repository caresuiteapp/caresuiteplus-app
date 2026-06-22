import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  resetDemoAccountingStore,
  setDemoInvoiceAccountingStatus,
  getDemoInvoiceAccountingStatus,
} from '@/data/demo/accounting';
import {
  applyInvoiceAccountingCorrection,
  assertInvoiceAccountingEditable,
  confirmPaymentMatchPrepared,
  executeInvoiceAccountingExport,
  executeInvoiceExportTransfer,
  fetchAccountingConnectDashboard,
  fetchAccountingProviderConfigs,
  fetchInvoiceAccountingSnapshot,
  getAccountingConnectStoreForTests,
  prepareBelegpaket,
  prepareInvoiceAccountingExport,
  prepareInvoiceExportBatch,
  preparePaymentImportCsv,
  prepareTaxAdvisorPackageZip,
  resetAccountingConnectStore,
  seedDemoAccountingProviderConfig,
  suggestPaymentMatch,
  PAYMENT_IMPORT_CSV_TEMPLATE,
} from '@/lib/accounting';
import { canViewAccountingProviderConfig } from '@/lib/accounting/accountingProviderConfigService';
import { updateInvoice } from '@/lib/office/invoiceDetailService';
import { listPreparedProviderKeys } from '@/lib/connect/gateway';

const ADMIN = 'business_admin' as const;
const NURSE = 'nurse' as const;
const TENANT = DEMO_TENANT_ID;

describe('0046_accounting_connect_prepared migration', () => {
  const sql = readFileSync(
    path.join(process.cwd(), 'supabase/migrations/0046_accounting_connect_prepared.sql'),
    'utf8',
  );

  it('legt alle sechs Buchhaltungs-Tabellen an', () => {
    for (const table of [
      'accounting_provider_configs',
      'invoice_accounting_status',
      'accounting_exports',
      'accounting_export_items',
      'document_archive_entries',
      'gobd_audit_events',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
  });

  it('speichert keine Klartext-API-Keys', () => {
    expect(sql).toContain('credential_vault_ref');
    expect(sql).not.toMatch(/api_key\s+TEXT/i);
  });

  it('markiert Export ohne external_transfer — kein completed-Status', () => {
    expect(sql).toContain('external_transfer');
    expect(sql).toContain("'prepared', 'queued', 'running', 'blocked', 'failed', 'cancelled'");
    expect(sql).not.toContain("'completed'");
  });

  it('aktiviert RLS auf allen Tabellen', () => {
    for (const table of [
      'accounting_provider_configs',
      'invoice_accounting_status',
      'accounting_exports',
      'accounting_export_items',
      'document_archive_entries',
      'gobd_audit_events',
    ]) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
  });
});

describe('0054_accounting_bank_reconciliation_prepared migration', () => {
  const sql = readFileSync(
    path.join(process.cwd(), 'supabase/migrations/0054_accounting_bank_reconciliation_prepared.sql'),
    'utf8',
  );

  it('legt Bankabgleich- und Audit-Tabellen an', () => {
    for (const table of [
      'tax_advisor_packages',
      'bank_transaction_imports',
      'bank_transactions',
      'payment_matching_suggestions',
      'accounting_audit_events',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
    expect(sql).toContain('CREATE OR REPLACE VIEW public.accounting_export_batches');
  });

  it('erzwingt Zahlungsbeleg — requires_receipt default true', () => {
    expect(sql).toContain('requires_receipt');
    expect(sql).toContain('NOT NULL DEFAULT TRUE');
  });

  it('aktiviert RLS auf neuen Tabellen', () => {
    for (const table of [
      'tax_advisor_packages',
      'bank_transaction_imports',
      'bank_transactions',
      'payment_matching_suggestions',
      'accounting_audit_events',
    ]) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
  });
});

describe('Accounting Connect — Provider vorbereitet', () => {
  beforeEach(() => {
    resetDemoAccountingStore();
  });

  it('listet DATEV, Lexware, sevDesk als vorbereitete Adapter', () => {
    const keys = listPreparedProviderKeys();
    expect(keys).toContain('datev');
    expect(keys).toContain('lexware_office');
    expect(keys).toContain('sevdesk');
    expect(keys).toContain('steuerberater_export');
  });
});

describe('Accounting Connect — Export ohne Produktiv-Konfiguration', () => {
  beforeEach(() => {
    resetDemoAccountingStore();
    resetAccountingConnectStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  it.each(['datev', 'lexware_office', 'sevdesk'] as const)(
    '%s ist ohne Konfiguration nicht produktiv ausführbar',
    async (providerKey) => {
      const result = await executeInvoiceAccountingExport(
        'inv-001',
        'RE-2026-001',
        TENANT,
        providerKey,
        ADMIN,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeTruthy();

      const snapshot = await fetchInvoiceAccountingSnapshot('inv-001', TENANT, ADMIN);
      expect(snapshot.ok).toBe(true);
      if (snapshot.ok) {
        expect(snapshot.data.status.accountingStatus).not.toBe('exportiert');
        expect(snapshot.data.status.accountingStatus).toBe('export_fehler');
      }
    },
  );

  it('setzt Export-Status nicht fälschlich auf exportiert', async () => {
    await prepareInvoiceAccountingExport('inv-001', 'RE-2026-001', TENANT, 'datev', ADMIN);
    const exec = await executeInvoiceAccountingExport('inv-001', 'RE-2026-001', TENANT, 'datev', ADMIN);
    expect(exec.ok).toBe(false);

    const snapshot = await fetchInvoiceAccountingSnapshot('inv-001', TENANT, ADMIN);
    if (snapshot.ok) {
      expect(snapshot.data.status.accountingStatus).toBe('export_fehler');
      expect(snapshot.data.exportHistory.every((e) => !e.externalTransfer)).toBe(true);
    }
  });

  it('bereitet Rechnungsexport, Belegpaket und Steuerberater-ZIP ohne Transfer vor', async () => {
    const exportResult = prepareInvoiceExportBatch({
      tenantId: TENANT,
      invoiceId: 'inv-001',
      invoiceNumber: 'RE-2026-001',
      providerKey: 'datev',
    });
    expect(exportResult.ok).toBe(true);
    if (exportResult.ok) {
      expect(exportResult.data.batch.status).toBe('prepared');
      expect(exportResult.data.batch.externalTransfer).toBe(false);
    }

    const belegResult = prepareBelegpaket({
      tenantId: TENANT,
      invoiceIds: ['inv-001', 'inv-002'],
      providerKey: 'lexware_office',
    });
    expect(belegResult.ok).toBe(true);

    const taxResult = prepareTaxAdvisorPackageZip({
      tenantId: TENANT,
      invoiceIds: ['inv-001'],
      invoiceNumbers: ['RE-2026-001'],
    });
    expect(taxResult.ok).toBe(true);
    if (taxResult.ok) {
      expect(taxResult.data.externalTransfer).toBe(false);
      expect(taxResult.data.zipReference).toContain('preparation://');
    }

    const transfer = await executeInvoiceExportTransfer({
      tenantId: TENANT,
      invoiceId: 'inv-001',
      invoiceNumber: 'RE-2026-001',
      providerKey: 'datev',
    });
    expect(transfer.ok).toBe(false);

    const dashboard = await fetchAccountingConnectDashboard(TENANT);
    expect(dashboard.ok).toBe(true);
    if (dashboard.ok) {
      expect(dashboard.data.exportBatches.length).toBeGreaterThan(0);
      expect(dashboard.data.taxAdvisorPackages.length).toBe(1);
      expect(dashboard.data.exportErrors.length).toBeGreaterThan(0);
    }
  });
});

describe('Accounting Connect — Zahlungsabgleich ohne Beleg', () => {
  beforeEach(() => {
    resetAccountingConnectStore();
    resetDemoAccountingStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  it('importiert CSV und blockiert Zahlungsbestätigung ohne Beleg', async () => {
    const beforeStatus = getDemoInvoiceAccountingStatus('inv-001').accountingStatus;

    const importResult = preparePaymentImportCsv({
      tenantId: TENANT,
      fileName: 'konto.csv',
      csvContent: PAYMENT_IMPORT_CSV_TEMPLATE,
    });
    expect(importResult.ok).toBe(true);
    if (!importResult.ok) return;

    const tx = importResult.data.transactions[0];
    const suggest = suggestPaymentMatch({
      tenantId: TENANT,
      bankTransactionId: tx.id,
      invoiceId: 'inv-001',
    });
    expect(suggest.ok).toBe(true);
    if (!suggest.ok) return;

    expect(suggest.data.requiresReceipt).toBe(true);

    const confirm = confirmPaymentMatchPrepared({
      tenantId: TENANT,
      suggestionId: suggest.data.id,
      receiptReference: null,
    });
    expect(confirm.ok).toBe(false);
    if (!confirm.ok) {
      expect(confirm.error).toMatch(/Beleg/i);
    }

    const afterStatus = getDemoInvoiceAccountingStatus('inv-001').accountingStatus;
    expect(afterStatus).not.toBe('bezahlt');
    expect(afterStatus).toBe(beforeStatus);

    const store = getAccountingConnectStoreForTests(TENANT);
    expect(store.auditEvents.some((e) => e.eventType === 'payment_confirm_blocked')).toBe(true);
  });

  it('erlaubt reconciled_prepared nur mit Belegreferenz', () => {
    preparePaymentImportCsv({
      tenantId: TENANT,
      fileName: 'konto.csv',
      csvContent: PAYMENT_IMPORT_CSV_TEMPLATE,
    });
    const tx = getAccountingConnectStoreForTests(TENANT).bankTransactions[0];
    const suggest = suggestPaymentMatch({
      tenantId: TENANT,
      bankTransactionId: tx.id,
      invoiceId: 'inv-001',
    });
    expect(suggest.ok).toBe(true);
    if (!suggest.ok) return;

    const confirm = confirmPaymentMatchPrepared({
      tenantId: TENANT,
      suggestionId: suggest.data.id,
      receiptReference: 'Kontoauszug-2026-06-Seite-3',
    });
    expect(confirm.ok).toBe(true);
    if (confirm.ok) {
      expect(confirm.data.status).toBe('accepted_prepared');
      expect(getDemoInvoiceAccountingStatus('inv-001').accountingStatus).not.toBe('bezahlt');
    }
  });
});

describe('Accounting Connect — GoBD-Schutz', () => {
  beforeEach(() => {
    resetDemoAccountingStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  it('blockiert direkte Bearbeitung archivierter Rechnung', async () => {
    setDemoInvoiceAccountingStatus('inv-001', { accountingStatus: 'gobd_archiviert' });

    const guard = assertInvoiceAccountingEditable('gobd_archiviert');
    expect(guard?.ok).toBe(false);

    const edit = await updateInvoice(
      'inv-001',
      TENANT,
      { notes: 'Silent change', dueDate: '2026-12-31' },
      ADMIN,
    );
    expect(edit.ok).toBe(false);
  });

  it('legt bei Korrektur einen GoBD-Audit an', async () => {
    setDemoInvoiceAccountingStatus('inv-001', { accountingStatus: 'gobd_archiviert' });

    const result = await applyInvoiceAccountingCorrection('inv-001', TENANT, 'korrektur', ADMIN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status.accountingStatus).toBe('korrigiert');
      expect(result.data.gobdAuditEvents.some((e) => e.eventType === 'korrektur_created')).toBe(true);
    }
  });
});

describe('Accounting Connect — Provider-Konfiguration', () => {
  beforeEach(() => {
    resetDemoAccountingStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  it('normale Nutzer sehen keine Anbieter-Konfiguration', async () => {
    expect(canViewAccountingProviderConfig(NURSE)).toBe(false);
    const denied = await fetchAccountingProviderConfigs(TENANT, NURSE);
    expect(denied.ok).toBe(false);
  });

  it('Admin kann Konfiguration laden (ohne Klartext-Secrets)', async () => {
    seedDemoAccountingProviderConfig('datev', {
      configStatus: 'configured',
      hasCredentialReference: true,
      configuredAt: new Date().toISOString(),
    });
    const result = await fetchAccountingProviderConfigs(TENANT, ADMIN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]?.credentialMasked).toContain('••••');
      expect(result.data[0]?.credentialMasked).not.toContain('accounting/datev');
    }
  });
});

describe('Accounting Connect — kein Demo-Fallback im Live-Modus', () => {
  beforeEach(() => {
    resetAccountingConnectStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  it('blockiert Connect-Buchhaltung ohne Live-Repository', async () => {
    const dashboard = await fetchAccountingConnectDashboard(TENANT);
    expect(dashboard.ok).toBe(false);
    if (!dashboard.ok) {
      expect(dashboard.error).toMatch(/Produktionsmodus|Live-Modus/i);
    }

    const exportResult = prepareInvoiceExportBatch({
      tenantId: TENANT,
      invoiceId: 'inv-001',
      invoiceNumber: 'RE-2026-001',
      providerKey: 'datev',
    });
    expect(exportResult.ok).toBe(false);
  });
});
