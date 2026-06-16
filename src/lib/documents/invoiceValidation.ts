import type { InvoiceRecord, InvoiceTaxMode } from '@/types/documents/invoice';
import type { TemplateValidationIssue, TemplateValidationResult } from '@/features/documents/templateEngine/types';
import { validateTaxLogicConsistency, type TaxCalculationResult } from './invoiceTaxLogic';

export function validateInvoiceRecord(
  invoice: InvoiceRecord,
  taxResult: TaxCalculationResult,
): TemplateValidationResult {
  const issues: TemplateValidationIssue[] = [];

  if (!invoice.invoiceNumber?.trim()) {
    issues.push({ code: 'invoice_number_missing', message: 'Rechnungsnummer fehlt.', fieldKey: 'invoice.number', severity: 'error' });
  }

  if (!invoice.recipient.fullName?.trim()) {
    issues.push({ code: 'recipient_missing', message: 'Rechnungsempfänger fehlt.', fieldKey: 'recipient.full_name', severity: 'error' });
  }

  if (!invoice.recipient.street?.trim() || !invoice.recipient.city?.trim()) {
    issues.push({ code: 'recipient_address_incomplete', message: 'Empfängeradresse unvollständig.', fieldKey: 'recipient.address', severity: 'error' });
  }

  if (!invoice.servicePeriod?.trim()) {
    issues.push({ code: 'service_period_missing', message: 'Leistungszeitraum fehlt.', fieldKey: 'invoice.service_period', severity: 'error' });
  }

  if (invoice.lineItems.length === 0) {
    issues.push({ code: 'line_items_missing', message: 'Leistungspositionen fehlen.', fieldKey: 'invoice.line_items', severity: 'error' });
  }

  if (!invoice.dueDate?.trim()) {
    issues.push({ code: 'due_date_missing', message: 'Zahlungsziel fehlt.', fieldKey: 'invoice.due_date', severity: 'error' });
  }

  if (!invoice.bankName?.trim() || !invoice.iban?.trim()) {
    issues.push({ code: 'bank_missing', message: 'Bankverbindung fehlt.', fieldKey: 'company.iban', severity: 'error' });
  }

  if (!invoice.paymentReference?.trim() && !invoice.invoiceNumber?.trim()) {
    issues.push({ code: 'payment_reference_missing', message: 'Verwendungszweck fehlt.', fieldKey: 'invoice.payment_reference', severity: 'error' });
  }

  const taxErrors = validateTaxLogicConsistency(taxResult, invoice.taxMode);
  for (const msg of taxErrors) {
    issues.push({ code: 'tax_logic_invalid', message: msg, fieldKey: 'invoice.tax_notice', severity: 'error' });
  }

  if (!invoice.previewConfirmed) {
    issues.push({ code: 'preview_required', message: 'PDF-Vorschau muss bestätigt sein.', severity: 'error' });
  }

  return {
    status: issues.some((i) => i.severity === 'error') ? 'error' : 'valid',
    issues,
  };
}

export function invoiceToDocumentContext(invoice: InvoiceRecord, taxResult: TaxCalculationResult) {
  const formatCents = (c: number) => (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 });
  return {
    company: {
      name: 'CareSuite Demo Pflegedienst GmbH',
      legal_name: 'CareSuite Demo Pflegedienst GmbH',
      street: 'Musterstraße 1',
      zip: '10115',
      city: 'Berlin',
      bank_name: invoice.bankName,
      iban: invoice.iban,
      bic: invoice.bic ?? '',
      tax_id: '27/123/45678',
      ik_number: invoice.companyIk ?? '',
    },
    recipient: {
      full_name: invoice.recipient.fullName,
      address: `${invoice.recipient.street}, ${invoice.recipient.zip} ${invoice.recipient.city}`,
      street: invoice.recipient.street,
      zip: invoice.recipient.zip,
      city: invoice.recipient.city,
    },
    client: {
      full_name: invoice.recipient.fullName,
      customer_number: invoice.recipient.customerNumber ?? '',
      care_level: invoice.recipient.careLevel ?? '',
    },
    cost_carrier: {
      name: invoice.costCarrierName ?? '',
      ik_number: invoice.costCarrierIk ?? '',
    },
    invoice: {
      number: invoice.invoiceNumber ?? '',
      date: invoice.invoiceDate,
      service_period: invoice.servicePeriod,
      due_date: invoice.dueDate,
      net_total: formatCents(taxResult.netTotalCents),
      tax_total: formatCents(taxResult.taxTotalCents),
      gross_total: formatCents(taxResult.grossTotalCents),
      tax_notice: taxResult.taxNotice,
      payment_reference: invoice.paymentReference ?? invoice.invoiceNumber ?? '',
      line_items: JSON.stringify(taxResult.lineItems),
    },
  };
}

export const STANDARD_INVOICE_HTML_TEMPLATE = `<div class="cs-invoice" data-doc-type="invoice">
<div class="cs-block-logo" data-layout-area="page_header">{{company.name}}</div>
<div class="cs-layout-area cs-sender-line" data-layout-area="sender_line">{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</div>
<div class="cs-layout-area cs-address-field" data-layout-area="address_field">
<p>{{recipient.full_name}}</p>
<p>{{recipient.address}}</p>
<p>Kundennummer: {{client.customer_number}}</p>
</div>
<div class="cs-layout-area cs-info-block" data-layout-area="info_block">
<p>Rechnungsnummer: {{invoice.number}}</p>
<p>Rechnungsdatum: {{invoice.date}}</p>
<p>Leistungszeitraum: {{invoice.service_period}}</p>
<p>Fällig: {{invoice.due_date}}</p>
</div>
<h1>Rechnung {{invoice.number}}</h1>
<div class="cs-layout-area cs-table-area" data-layout-area="table_area">
<table class="cs-block-table">
<thead><tr><th>Pos.</th><th>Leistung</th><th>Menge</th><th>Einheit</th><th>Einzelpreis</th><th>Netto</th></tr></thead>
<tbody>{{invoice.line_items_table}}</tbody>
</table>
</div>
<div class="cs-layout-area cs-legal-notice" data-layout-area="legal_notice_area">
<p>Netto: {{invoice.net_total}} · Steuer: {{invoice.tax_total}} · Brutto: {{invoice.gross_total}}</p>
<p>{{invoice.tax_notice}}</p>
</div>
<div class="cs-block-footer" data-layout-area="footer">
<p>Bank: {{company.bank_name}} · IBAN: {{company.iban}} · Verwendungszweck: {{invoice.payment_reference}}</p>
<p>{{company.legal_name}} · {{company.tax_id}} · IK: {{company.ik_number}}</p>
</div>
<div class="cs-block-qr" data-prepared="true">[QR optional: {{invoice.payment_reference}}]</div>
</div>`;

export function renderLineItemsTableHtml(lineItems: InvoiceRecord['lineItems']): string {
  return lineItems
    .map(
      (item, idx) =>
        `<tr><td>${idx + 1}</td><td>${item.description}</td><td>${item.quantity}</td><td>${item.unit}</td><td>${(item.unitPriceNetCents / 100).toFixed(2)}</td><td>${(item.netTotalCents / 100).toFixed(2)}</td></tr>`,
    )
    .join('');
}
