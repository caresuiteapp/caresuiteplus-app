import { describe, expect, it } from 'vitest';
import { buildInvoiceRunPreview, invoiceRunPeriod, type InvoiceRunInput, type InvoiceRunSourceData } from '@/lib/office/invoiceRunModel.web';

const tenant = '11111111-1111-4111-8111-111111111111';
const client = '22222222-2222-4222-8222-222222222222';
const request = '33333333-3333-4333-8333-333333333333';
const sourceId = '44444444-4444-4444-8444-444444444444';
const input: InvoiceRunInput = { month: '2026-09', includeProofs: false, invoiceDate: '2026-10-01', productKey: 'assist' };
const now = new Date('2026-10-18T08:00:00Z');
function data(): InvoiceRunSourceData {
  return {
    sources: [{ id: sourceId, tenant_id: tenant, client_id: client, product_key: 'assist', service_date: '2026-09-15',
      status: 'approved', actual_minutes: 120, billable_minutes: 120, hourly_rate: 32.75, total_amount: 65.5,
      updated_at: '2026-09-16T12:00:00Z', record_number: 'LN-001', assignment_id: null }],
    clients: [{ id: client, tenant_id: tenant, first_name: 'Test', last_name: 'Klient', street: 'Testweg', house_number: '1', postal_code: '12345', city: 'Teststadt', country: 'Deutschland' }],
    billingProfiles: [{ id: 'billing', tenant_id: tenant, client_id: client, billing_type: 'selbstzahler', invoice_recipient: null, payment_terms_days: 14 }],
    recipients: [],
    settings: [{ id: 'settings', tenant_id: tenant, self_payer_vat_rate: 0, insurance_vat_rate: 0, invoice_footer_text: 'Steuerbefreiung laut Unternehmensangaben.', payment_terms_days: 30 }],
  };
}
function preview(source = data(), overrides: Partial<InvoiceRunInput> = {}) {
  const result = buildInvoiceRunPreview(tenant, { ...input, ...overrides }, source, now, () => request);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

describe('Web Rechnungslauf – echte Leistungsquellen', () => {
  it('berechnet Monatsgrenzen einschließlich Schaltjahr ohne Zeitzonenverschiebung', () => {
    expect(invoiceRunPeriod('2024-02')).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(invoiceRunPeriod('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(invoiceRunPeriod('2026-13')).toBeNull();
    expect(invoiceRunPeriod('2026-00')).toBeNull();
  });
  it('erstellt eine reine Entwurfsvorschau mit Einzelposition und stabilem Quellenstand', () => {
    const original = data(); const before = JSON.stringify(original);
    const result = preview(original);
    expect(result.eligibleCount).toBe(1);
    expect(result.totalCents).toBe(6550);
    expect(result.groups[0].draft).toMatchObject({ invoiceNumber: '', requestId: request, dueDate: '2026-10-15', includeProofs: false });
    expect(result.groups[0].draft.lines[0]).toMatchObject({ quantity: 1, unitPriceCents: 6550, serviceRecordId: sourceId, sourceUpdatedAt: '2026-09-16T12:00:00Z' });
    expect(JSON.stringify(original)).toBe(before);
  });
  it('rechnet Minuten nachvollziehbar in Stunden und Cent um', () => {
    const original = data(); Object.assign(original.sources[0], { actual_minutes: 95, billable_minutes: 95, total_amount: 51.85 });
    const result = preview(original);
    expect(result.groups[0].draft.lines[0]).toMatchObject({ quantity: 1, unitPriceCents: 5185 });
    expect(result.groups[0].draft.lines[0].description).toContain('95 Minuten');
    expect(result.totalCents).toBe(5185);
  });
  it('ersetzt fehlende Preise und tatsächliche Zeiten nicht durch Planwerte oder null Euro', () => {
    const original = data(); Object.assign(original.sources[0], { actual_minutes: null, hourly_rate: null, total_amount: null, planned_minutes: 120 });
    const result = preview(original);
    expect(result.eligibleCount).toBe(0);
    expect(result.groups[0].totalCents).toBeNull();
    expect(result.groups[0].blockers.join(' ')).toMatch(/tatsächlich erfasste Leistungsdauer.*Stundensatz.*Leistungsbetrag/);
  });
  it('blockiert abweichende Beträge und zu hohe Abrechnungsdauer', () => {
    const original = data(); Object.assign(original.sources[0], { actual_minutes: 90, total_amount: 70 });
    const reasons = preview(original).groups[0].blockers.join(' ');
    expect(reasons).toMatch(/überschreitet/);
    expect(reasons).toMatch(/stimmen nicht überein/);
  });
  it('schließt bereits zugeordnete und stornierte Nachweise aus', () => {
    const original = data();
    original.sources.push({ ...original.sources[0], id: '55555555-5555-4555-8555-555555555555', status: 'billed', billed_invoice_id: 'existing' },
      { ...original.sources[0], id: '66666666-6666-4666-8666-666666666666', status: 'cancelled' });
    const result = preview(original);
    expect(result.groups[0].sourceCount).toBe(1);
    expect(result.alreadyBilledCount).toBe(1);
    expect(result.excludedCount).toBe(1);
    expect(result.totalCents).toBe(6550);
  });
  it('lässt einen ungeprüften Nachweis sichtbar und blockiert dessen Klientengruppe', () => {
    const original = data(); original.sources[0].status = 'review_required';
    const result = preview(original);
    expect(result.groups).toHaveLength(1);
    expect(result.blockedCount).toBe(1);
    expect(result.groups[0].blockers.join(' ')).toMatch(/noch nicht zur Abrechnung freigegeben/);
  });
  it('hält dieselbe Nachweisbereitschaft mit und ohne PDF-Anlage ein', () => {
    const original = data(); original.sources[0].status = 'signed';
    expect(preview(original).groups[0].eligible).toBe(false);
    const attached = preview(original, { includeProofs: true });
    expect(attached.groups[0].eligible).toBe(false);
    expect(attached.groups[0].blockers.join(' ')).toMatch(/Nachweis-PDF/);
    expect(attached.groups[0].proofIds).toEqual([`record:${sourceId}`]);
  });
  it('verlangt bei einsatzgebundenen Nachweisen die passende bestätigte Quelle', () => {
    const original = data(); original.sources[0].assignment_id = 'assignment';
    expect(preview(original).groups[0].blockers.join(' ')).toMatch(/bestätigte signierte Nachweisfassung/);
    original.sources[0].source_receipt = { version: 'workflow-assignment-record-v1', tenant_id: tenant, client_id: client,
      assignment_id: 'assignment', actual_minutes: 120, pdf_storage_path: `tenant/${tenant}/proof.pdf`, pdf_sha256: 'a'.repeat(64), attested_at: '2026-09-16T12:00:00Z' };
    expect(preview(original, { includeProofs: true }).groups[0].eligible).toBe(true);
    (original.sources[0].source_receipt as Record<string, unknown>).client_id = 'foreign';
    expect(preview(original).groups[0].eligible).toBe(false);
  });
  it('ersetzt einen Pflegekassenempfänger niemals durch die Klientenanschrift', () => {
    const original = data(); original.billingProfiles[0].billing_type = 'pflegekasse';
    const result = preview(original);
    expect(result.groups[0].eligible).toBe(false);
    expect(result.groups[0].draft.recipient.name).toBe('');
    expect(result.groups[0].blockers.join(' ')).toMatch(/Empfängeranschrift/);
  });
  it('blockiert mehrdeutige Empfänger und unaufgeteilte Kombiabrechnung', () => {
    const original = data(); original.billingProfiles[0].billing_type = 'kombi';
    original.recipients = ['a', 'b'].map(id => ({ id, tenant_id: tenant, client_id: client, carrier_type: 'care_insurance', name_snapshot: id, address_snapshot: { street: 'Weg 1', postalCode: '12345', city: 'Stadt' }, billing_relevant: true, is_primary: true }));
    const reasons = preview(original).groups[0].blockers.join(' ');
    expect(reasons).toMatch(/Aufteilung/);
    expect(reasons).toMatch(/Mehrere Rechnungsempfänger/);
  });
  it('zeigt keine erfundene Steuervoreinstellung und verlangt die Nettoentscheidung', () => {
    const original = data(); original.settings[0].self_payer_vat_rate = null;
    expect(preview(original).groups[0].totalCents).toBeNull();
    original.settings[0].self_payer_vat_rate = 19;
    expect(preview(original).groups[0].eligible).toBe(false);
    const explicit = preview(original, { taxRatePercent: 19 });
    expect(explicit.groups[0].eligible).toBe(true);
    expect(explicit.totalCents).toBe(7795);
  });
  it('begrenzt den Lauf auf den gewählten Monat und Leistungsbereich', () => {
    const original = data(); original.sources.push({ ...original.sources[0], id: 'outside', service_date: '2026-08-31' },
      { ...original.sources[0], id: 'different', product_key: 'pflege' });
    expect(preview(original).groups[0].sourceCount).toBe(1);
    expect(preview(original, { productKey: 'all' }).groups[0].sourceCount).toBe(2);
  });
  it('verweigert fremde Mandantendaten, doppelte Quellen und ungültige Fälligkeit', () => {
    const original = data(); original.clients[0].tenant_id = 'foreign';
    expect(buildInvoiceRunPreview(tenant, input, original, now, () => request).ok).toBe(false);
    const duplicate = data(); duplicate.sources.push({ ...duplicate.sources[0] });
    expect(buildInvoiceRunPreview(tenant, input, duplicate, now, () => request).ok).toBe(false);
    expect(buildInvoiceRunPreview(tenant, { ...input, dueDate: '2026-09-30' }, data(), now, () => request).ok).toBe(false);
  });
  it('übernimmt nur die gültige Kostenträgeranschrift und Versicherungsart aus der echten Zuordnung', () => {
    const original = data(); original.billingProfiles[0].billing_type = 'pflegekasse';
    original.billingProfiles[0].invoice_recipient = 'Pflegekasse Beispiel';
    original.recipients = [{ id: 'carrier', tenant_id: tenant, client_id: client, carrier_type: 'care_insurance',
      name_snapshot: 'Pflegekasse Beispiel', address_snapshot: { street: 'Kassenweg 2', postalCode: '23456', city: 'Kassenstadt', country: 'DE' },
      billing_relevant: true, is_primary: true, valid_from: '2026-09-01', valid_until: '2026-09-30' }];
    const valid = preview(original);
    expect(valid.groups[0].eligible).toBe(true);
    expect(valid.groups[0].draft).toMatchObject({ recipientType: 'care_insurance', billingParty: 'care_insurance',
      recipient: { name: 'Pflegekasse Beispiel', street: 'Kassenweg 2', postalCode: '23456' } });
    original.recipients[0].valid_until = '2026-09-14';
    expect(preview(original).groups[0].eligible).toBe(false);
    original.recipients[0].valid_until = '2026-09-30';
    original.recipients[0].name_snapshot = 'Andere Pflegekasse';
    expect(preview(original).groups[0].eligible).toBe(false);
    expect(preview(original).groups[0].draft.recipient.name).toBe('');
  });

});
