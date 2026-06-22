import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildInvoiceListKpis } from '@/lib/office/invoiceListStats';
import { demoInvoices } from '@/data/demo/invoices';
import { fetchInvoiceList } from '@/lib/office/invoiceListService';
import { fetchInvoiceDetail } from '@/lib/office/invoiceDetailService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';
import { INVOICE_STATUS_FILTERS, INVOICE_SORT_OPTIONS } from '@/hooks/useInvoiceList';
import type { InvoiceListItem } from '@/types/modules/billing';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const demoListItems: InvoiceListItem[] = demoInvoices.map((inv) => ({
  id: inv.id,
  tenantId: inv.tenantId,
  clientId: inv.clientId,
  clientName: 'Demo',
  invoiceNumber: inv.invoiceNumber,
  amountCents: inv.amountCents,
  currency: inv.currency,
  dueDate: inv.dueDate,
  status: inv.status,
  updatedAt: inv.updatedAt,
}));

describe('Office Rechnungen list', () => {
  it('enforcePermission schützt Invoice-List-Service', () => {
    expect(enforcePermission(null, 'office.invoices.view' as never)).not.toBeNull();
  });

  it('fetchInvoiceList liefert Demo-Rechnungen', async () => {
    const result = await fetchInvoiceList(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.invoiceNumber).toBeTruthy();
    }
  });

  it('fetchInvoiceDetail liefert Demo-Detail', async () => {
    const result = await fetchInvoiceDetail('inv-001', DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.invoiceNumber).toBe('RE-2026-0341');
    }
  });

  it('buildInvoiceListKpis berechnet Kennzahlen aus Demo-Daten', () => {
    const kpis = buildInvoiceListKpis(demoListItems);
    expect(kpis.length).toBe(3);
    expect(kpis.some((k) => k.id === 'invoices-kpi-open')).toBe(true);
  });

  it('Status- und Sortierfilter sind vollständig definiert', () => {
    expect(INVOICE_STATUS_FILTERS.some((f) => f.key === 'aktiv')).toBe(true);
    expect(INVOICE_SORT_OPTIONS.some((o) => o.key === 'due_asc')).toBe(true);
  });

  it('InvoicesListView hat Suche, Filter und States', () => {
    const source = readSrc('src/components/office/InvoicesListView.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('EmptyState');
    expect(source).not.toContain('Coming Soon');
  });

  it('InvoicesAdaptiveScreen nutzt MasterDetailLayout mit Summary-Panel', () => {
    const source = readSrc('src/screens/office/InvoicesAdaptiveScreen.tsx');
    expect(source).toContain('MasterDetailLayout');
    expect(source).toContain('InvoiceDetailSummaryPanel');
  });

  it('invoiceListService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/office/invoiceListService.ts');
    expect(source).toContain('guardServiceTenant');
  });

  it('invoiceDetailService nutzt guardServiceTenant', () => {
    const source = readSrc('src/lib/office/invoiceDetailService.ts');
    expect(source).toContain('guardServiceTenant');
  });
});
