import type {
  ElectronicInvoiceData,
  ElectronicInvoiceFormat,
  ElectronicInvoiceStatus,
  InvoiceRecord,
} from '@/types/documents/invoice';
import { EINVOICE_DISCLAIMER } from '@/types/documents/invoice';
import type { TaxCalculationResult } from './invoiceTaxLogic';
import { formatCents } from './invoiceTaxLogic';

export type EInvoiceEngineInfo = {
  productionAvailable: boolean;
  validatorAvailable: boolean;
  message: string;
};

export const EINVOICE_ENGINE_INFO: EInvoiceEngineInfo = {
  productionAvailable: false,
  validatorAvailable: false,
  message: EINVOICE_DISCLAIMER,
};

export function isEInvoiceEngineAvailable(): boolean {
  return EINVOICE_ENGINE_INFO.productionAvailable;
}

export function isEInvoiceValidatorAvailable(): boolean {
  return EINVOICE_ENGINE_INFO.validatorAvailable;
}

export function buildElectronicInvoiceData(
  invoice: InvoiceRecord,
  taxResult: TaxCalculationResult,
): ElectronicInvoiceData {
  const errors: string[] = [];

  if (!invoice.invoiceNumber) errors.push('Rechnungsnummer fehlt für E-Rechnung.');
  if (!invoice.recipient.fullName) errors.push('Käufer (Empfänger) fehlt.');
  if (!invoice.recipient.street || !invoice.recipient.zip) errors.push('Käuferadresse unvollständig.');
  if (invoice.lineItems.length === 0) errors.push('Rechnungspositionen fehlen.');
  if (!invoice.iban) errors.push('Verkäufer-Bankverbindung fehlt für Zahlungsdaten.');

  const buyerReference = invoice.recipient.customerNumber ?? invoice.recipient.fullName;
  const sellerReference = invoice.companyIk ?? invoice.invoiceNumber ?? '';

  const basePayload = {
    invoice_number: invoice.invoiceNumber,
    issue_date: invoice.invoiceDate,
    due_date: invoice.dueDate,
    buyer: {
      name: invoice.recipient.fullName,
      street: invoice.recipient.street,
      zip: invoice.recipient.zip,
      city: invoice.recipient.city,
      reference: buyerReference,
    },
    seller: {
      name: 'CareSuite Demo Pflegedienst GmbH',
      iban: invoice.iban,
      bic: invoice.bic,
      ik: invoice.companyIk,
      reference: sellerReference,
    },
    line_items: taxResult.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_net: formatCents(item.unitPriceNetCents),
      tax_rate: item.taxRatePercent,
      net_total: formatCents(item.netTotalCents),
    })),
    totals: {
      net: formatCents(taxResult.netTotalCents),
      tax: formatCents(taxResult.taxTotalCents),
      gross: formatCents(taxResult.grossTotalCents),
    },
    tax_notice: taxResult.taxNotice,
  };

  const status: ElectronicInvoiceStatus =
    errors.length === 0 ? 'ready' : 'incomplete';

  return {
    buyerReference,
    sellerReference,
    invoiceXmlPayload: errors.length === 0 ? { ...basePayload, format: 'ubl_invoice_2_1_prepared' } : null,
    xrechnungPayload: errors.length === 0 ? { ...basePayload, profile: 'xrechnung_3_0_prepared' } : null,
    zugferdPayload: errors.length === 0 ? { ...basePayload, profile: 'zugferd_2_1_prepared', embedded_pdf: false } : null,
    electronicInvoiceStatus: status,
    electronicInvoiceFormat: 'xrechnung',
    validationErrors: errors,
  };
}

export function validateElectronicInvoiceData(data: ElectronicInvoiceData): ElectronicInvoiceData {
  if (data.validationErrors.length > 0) {
    return { ...data, electronicInvoiceStatus: 'incomplete' };
  }
  return { ...data, electronicInvoiceStatus: 'validated' };
}

export type EInvoiceExportResult =
  | { ok: true; format: ElectronicInvoiceFormat; path: string; simulated: boolean }
  | { ok: false; error: string };

export function exportElectronicInvoice(
  data: ElectronicInvoiceData,
  format: ElectronicInvoiceFormat,
): EInvoiceExportResult {
  if (!isEInvoiceEngineAvailable()) {
    return {
      ok: false,
      error: 'XML-/E-Rechnungs-Export vorbereitet — Engine nicht produktiv verfügbar.',
    };
  }

  if (data.electronicInvoiceStatus === 'incomplete') {
    return { ok: false, error: 'E-Rechnungsdaten unvollständig.' };
  }

  return {
    ok: true,
    format,
    path: `einvoice/export/${format}/${Date.now()}.xml`,
    simulated: false,
  };
}

export function canExportElectronicInvoice(data: ElectronicInvoiceData): boolean {
  return isEInvoiceEngineAvailable() && data.electronicInvoiceStatus !== 'incomplete';
}

export function canGenerateXml(data: ElectronicInvoiceData): boolean {
  return canExportElectronicInvoice(data);
}

export function canGeneratePdfPlusXml(data: ElectronicInvoiceData): boolean {
  return canExportElectronicInvoice(data);
}
