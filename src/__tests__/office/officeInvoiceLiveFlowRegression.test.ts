import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canTransitionInvoiceStatus,
  getAllowedInvoiceStatusActions,
  INVOICE_STATUS_LABELS,
} from '@/lib/office/invoiceStatus';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Office Rechnung – Live-Datenfluss', () => {
  it('verwendet echte Rechnungsstatus mit deutschen Beschriftungen', () => {
    expect(INVOICE_STATUS_LABELS.draft).toBe('Entwurf');
    expect(INVOICE_STATUS_LABELS.partly_paid).toBe('Teilbezahlt');
    expect(getAllowedInvoiceStatusActions('draft')).toEqual(['ready', 'cancelled']);
    expect(canTransitionInvoiceStatus('draft', 'paid')).toBe(false);
  });

  it('lädt Klient:innennamen und Positionen statt Rechnungsnummer-Dubletten', () => {
    const repository = read('src/lib/services/repositories/invoiceRepository.supabase.ts');
    const list = read('src/lib/office/invoiceListService.ts');
    const detail = read('src/lib/office/invoiceDetailService.ts');
    expect(repository).toContain("from('clients')");
    expect(repository).toContain("from('invoice_items')");
    expect(list).toContain('clientName: inv.client_name');
    expect(detail).toContain('clientName: row.client_name');
    expect(detail).not.toContain('clientName: row.invoice_number');
  });

  it('verhindert leere Rechnungen und übernimmt Nachweise oder kontrollierte Katalogpositionen', () => {
    const create = read('src/lib/office/invoiceCreateService.ts');
    const repository = read('src/lib/services/repositories/invoiceRepository.supabase.ts');
    expect(create).toContain(".in('status', ['approved', 'billable'])");
    expect(create).toContain('records.data.length === 0');
    expect(repository).toContain('createFromServiceRecords');
    expect(repository).toContain('createFromCatalogPosition');
    expect(create).toContain('fetchInvoiceCatalogOptions');
    expect(repository).toContain("from('invoice_items').insert");
    expect(repository).toContain("status: 'billed'");
    expect(repository).toContain('service_period_from');
    expect(repository).toContain('invoice_date: input.invoiceDate');
    expect(create).toContain('fetchInvoiceBudgetCapacity');
    expect(create).toContain("catalogQuantityMode === 'manual'");
  });

  it('speichert echte Datumswerte und einen frei gewählten Leistungszeitraum', () => {
    const repository = read('src/lib/services/repositories/invoiceRepository.supabase.ts');
    const migration = read('supabase/migrations/0261_invoice_service_period.sql');
    expect(repository).toContain('service_month: input.servicePeriodStart');
    expect(repository).not.toContain('service_month: input.servicePeriodStart.slice(0, 7)');
    expect(migration).toContain('service_period_from DATE');
    expect(migration).toContain('service_period_to DATE');
    expect(migration).toContain('service_period_from <= service_period_to');
  });

  it('erlaubt das bestätigte Löschen alter leerer Entwürfe', () => {
    const detail = read('src/screens/office/InvoiceDetailScreen.tsx');
    const service = read('src/lib/office/invoiceDetailService.ts');
    expect(detail).toContain('Rechnungsentwurf löschen');
    expect(service).toContain('deleteDraftInvoice');
    expect(service).toContain("current.data.status !== 'draft'");
  });
});
