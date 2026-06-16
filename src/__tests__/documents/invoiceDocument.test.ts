import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  KLEINUNTERNEHMER_NOTICE,
  USTG_4_16_NOTICE,
} from '@/types/documents/invoice';
import {
  allocateInvoiceNumber,
  calculateInvoiceTax,
  confirmInvoicePreview,
  createInvoiceCancellation,
  createInvoiceCorrection,
  createInvoiceDraft,
  finalizeInvoice,
  getEInvoiceUiState,
  getTaxNotice,
  attemptEditInvoice,
  patchInvoiceForTest,
  resetInvoiceDocumentStore,
  resetInvoiceNumberRegistry,
  resetLifecycleDocumentStore,
  reserveInvoiceNumber,
  validateInvoiceForFinalization,
} from '@/lib/documents';

const TENANT = DEMO_TENANT_ID;
const ADMIN = 'business_admin' as const;

describe('invoice document module', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetInvoiceDocumentStore();
    resetInvoiceNumberRegistry();
    resetLifecycleDocumentStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetInvoiceDocumentStore();
    resetInvoiceNumberRegistry();
    resetLifecycleDocumentStore();
  });

  it('Rechnung ohne Empfänger blockiert', () => {
    const inv = createInvoiceDraft({ tenantId: TENANT, taxMode: 'ustg_4_16_exempt' });
    patchInvoiceForTest({
      ...inv,
      recipient: { ...inv.recipient, fullName: '', street: '', zip: '', city: '' },
      previewConfirmed: true,
      invoiceNumber: 'RE-2026-0099',
      paymentReference: 'RE-2026-0099',
    });

    const result = validateInvoiceForFinalization(TENANT, inv.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.validation.status).toBe('error');
      expect(result.data.validation.issues.some((i) => i.code === 'recipient_missing')).toBe(true);
    }
  });

  it('Rechnung ohne Positionen blockiert', () => {
    const inv = createInvoiceDraft({ tenantId: TENANT, taxMode: 'ustg_4_16_exempt' });
    patchInvoiceForTest({
      ...inv,
      lineItems: [],
      previewConfirmed: true,
      invoiceNumber: 'RE-2026-0098',
      paymentReference: 'RE-2026-0098',
    });

    const result = validateInvoiceForFinalization(TENANT, inv.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.validation.issues.some((i) => i.code === 'line_items_missing')).toBe(true);
    }
  });

  it('Steuerfrei-Hinweis erscheint bei § 4 Nr. 16 UStG', () => {
    const result = calculateInvoiceTax({
      taxMode: 'ustg_4_16_exempt',
      lineItems: [{ id: '1', description: 'Pflege', quantity: 1, unit: 'h', unitPriceNetCents: 10000, taxRatePercent: 0 }],
    });
    expect(result.taxNotice).toBe(USTG_4_16_NOTICE);
    expect(result.taxTotalCents).toBe(0);
    expect(getTaxNotice('ustg_4_16_exempt')).toContain('§ 4 Nr. 16');
  });

  it('19 % USt erscheint bei Selbstzahler-Modus', () => {
    const result = calculateInvoiceTax({
      taxMode: 'standard_vat_19',
      lineItems: [{ id: '1', description: 'Beratung', quantity: 1, unit: 'h', unitPriceNetCents: 10000, taxRatePercent: 19 }],
    });
    expect(result.taxTotalCents).toBe(1900);
    expect(result.grossTotalCents).toBe(11900);
    expect(result.taxNotice).toContain('19');
  });

  it('Kleinunternehmerhinweis erscheint bei § 19 Modus', () => {
    const result = calculateInvoiceTax({
      taxMode: 'kleinunternehmer_19',
      lineItems: [{ id: '1', description: 'Leistung', quantity: 1, unit: 'Stk', unitPriceNetCents: 5000, taxRatePercent: 0 }],
    });
    expect(result.taxNotice).toBe(KLEINUNTERNEHMER_NOTICE);
    expect(result.taxTotalCents).toBe(0);
  });

  it('Finalisierte Rechnung gesperrt', async () => {
    const inv = createInvoiceDraft({ tenantId: TENANT, taxMode: 'ustg_4_16_exempt' });
    await confirmInvoicePreview(TENANT, inv.id, ADMIN);
    const finalized = await finalizeInvoice(TENANT, inv.id, ADMIN);

    expect(finalized.ok).toBe(true);
    if (finalized.ok) {
      expect(finalized.data.lockedAt).toBeTruthy();
      expect(finalized.data.status).toBe('finalized');
    }
  });

  it('Storno referenziert Ursprungsrechnung', async () => {
    const inv = createInvoiceDraft({ tenantId: TENANT, taxMode: 'ustg_4_16_exempt' });
    await confirmInvoicePreview(TENANT, inv.id, ADMIN);
    await finalizeInvoice(TENANT, inv.id, ADMIN);

    const storno = await createInvoiceCancellation(TENANT, inv.id, ADMIN);
    expect(storno.ok).toBe(true);
    if (storno.ok) {
      expect(storno.data.cancelledFromInvoiceId).toBe(inv.id);
      expect(storno.data.status).toBe('cancellation');
    }
  });

  it('Korrektur referenziert Ursprungsrechnung', async () => {
    const inv = createInvoiceDraft({ tenantId: TENANT, taxMode: 'ustg_4_16_exempt' });
    await confirmInvoicePreview(TENANT, inv.id, ADMIN);
    await finalizeInvoice(TENANT, inv.id, ADMIN);

    const correction = await createInvoiceCorrection(TENANT, inv.id, ADMIN);
    expect(correction.ok).toBe(true);
    if (correction.ok) {
      expect(correction.data.correctedFromInvoiceId).toBe(inv.id);
      expect(correction.data.status).toBe('correction');
    }
  });

  it('E-Rechnung-Button disabled, wenn Daten unvollständig', () => {
    const inv = createInvoiceDraft({ tenantId: TENANT, taxMode: 'ustg_4_16_exempt' });
    patchInvoiceForTest({ ...inv, invoiceNumber: null });

    const ui = getEInvoiceUiState(TENANT, inv.id);
    expect(ui.canGenerateXml).toBe(false);
    expect(ui.canGeneratePdfPlusXml).toBe(false);
  });

  it('Keine doppelte Rechnungsnummer', () => {
    const first = allocateInvoiceNumber(TENANT);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const duplicate = reserveInvoiceNumber(TENANT, first.data);
    expect(duplicate.ok).toBe(false);

    const inv = createInvoiceDraft({ tenantId: TENANT, taxMode: 'ustg_4_16_exempt' });
    patchInvoiceForTest({ ...inv, invoiceNumber: first.data, paymentReference: first.data, previewConfirmed: true });
    const edit = validateInvoiceForFinalization(TENANT, inv.id);
    expect(edit.ok).toBe(true);
  });

  it('Direkte Bearbeitung finalisierter Rechnung blockiert', async () => {
    const inv = createInvoiceDraft({ tenantId: TENANT, taxMode: 'ustg_4_16_exempt' });
    await confirmInvoicePreview(TENANT, inv.id, ADMIN);
    await finalizeInvoice(TENANT, inv.id, ADMIN);

    const edit = await attemptEditInvoice(TENANT, inv.id, ADMIN);
    expect(edit.ok).toBe(false);
  });
});
