/** Rechnungsmodul — Typen für Validierung, Steuerlogik und E-Rechnung-Vorbereitung */

export type InvoiceTaxMode =
  | 'ustg_4_16_exempt'
  | 'standard_vat_19'
  | 'kleinunternehmer_19';

export type InvoiceDocumentStatus = 'draft' | 'finalized' | 'cancellation' | 'correction' | 'render_failed';

export type ElectronicInvoiceFormat = 'xrechnung' | 'zugferd' | 'xml' | 'none';

export type ElectronicInvoiceStatus =
  | 'not_prepared'
  | 'incomplete'
  | 'ready'
  | 'validated'
  | 'export_prepared'
  | 'exported';

export type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceNetCents: number;
  taxRatePercent: number;
  netTotalCents: number;
  taxTotalCents: number;
  grossTotalCents: number;
};

export type InvoiceRecipient = {
  fullName: string;
  street: string;
  zip: string;
  city: string;
  customerNumber?: string;
  careLevel?: string;
};

export type InvoiceRecord = {
  id: string;
  tenantId: string;
  invoiceNumber: string | null;
  status: InvoiceDocumentStatus;
  taxMode: InvoiceTaxMode;
  invoiceDate: string;
  servicePeriod: string;
  dueDate: string;
  paymentReference: string | null;
  recipient: InvoiceRecipient;
  lineItems: InvoiceLineItem[];
  netTotalCents: number;
  taxTotalCents: number;
  grossTotalCents: number;
  taxNotice: string;
  costCarrierName?: string | null;
  costCarrierIk?: string | null;
  companyIk?: string | null;
  bankName: string;
  iban: string;
  bic?: string | null;
  lockedAt: string | null;
  correctedFromInvoiceId: string | null;
  cancelledFromInvoiceId: string | null;
  lifecycleDocumentId: string | null;
  previewConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ElectronicInvoiceData = {
  buyerReference: string | null;
  sellerReference: string | null;
  invoiceXmlPayload: Record<string, unknown> | null;
  xrechnungPayload: Record<string, unknown> | null;
  zugferdPayload: Record<string, unknown> | null;
  electronicInvoiceStatus: ElectronicInvoiceStatus;
  electronicInvoiceFormat: ElectronicInvoiceFormat;
  validationErrors: string[];
};

export type InvoiceAuditEventType =
  | 'invoice_created'
  | 'invoice_validated'
  | 'invoice_validation_failed'
  | 'invoice_finalized'
  | 'invoice_locked'
  | 'invoice_edit_blocked'
  | 'invoice_cancellation_created'
  | 'invoice_correction_created'
  | 'einvoice_validated'
  | 'einvoice_export_prepared'
  | 'invoice_number_assigned';

export type InvoiceAuditEvent = {
  id: string;
  tenantId: string;
  invoiceId: string;
  eventType: InvoiceAuditEventType;
  summary: string;
  metadata?: Record<string, string>;
  createdAt: string;
};

export const TAX_MODE_LABELS: Record<InvoiceTaxMode, string> = {
  ustg_4_16_exempt: '§ 4 Nr. 16 UStG (steuerfrei)',
  standard_vat_19: 'Regelsteuersatz 19 %',
  kleinunternehmer_19: 'Kleinunternehmer § 19 UStG',
};

export const USTG_4_16_NOTICE =
  'Die abgerechneten Leistungen sind gemäß § 4 Nr. 16 UStG umsatzsteuerfrei.';

export const KLEINUNTERNEHMER_NOTICE =
  'Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.';

export const EINVOICE_DISCLAIMER =
  'E-Rechnung (XRechnung/ZUGFeRD) ist strukturell vorbereitet — Produktionsexport und Validator folgen.';
