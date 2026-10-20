import type { OfficeInvoiceDraftLine, OfficeInvoiceRecipient } from './invoiceWorkspaceTypes.web';

export type OfficeEInvoiceAnswer = 'unknown' | 'yes' | 'no';
export type OfficeEInvoiceTaxCategory = 'S' | 'Z' | 'E' | 'AE' | 'O';
export type OfficeEInvoiceLineTax = {
  category: OfficeEInvoiceTaxCategory | '';
  /** UNECE Recommendation 20/21 code, independent of the displayed unit label. */
  unitCode: string;
  exemptionReason: string;
  exemptionReasonCode: string;
  /** User-confirmed legal classification, never inferred from a zero tax rate. */
  legalBasis: 'unknown' | 'none' | 'ustg_4_8_29' | 'ustg_19' | 'other';
};
export type OfficeEInvoiceEndpoint = { schemeId: string; value: string };
export type OfficeEInvoiceMetadata = {
  version: 1;
  format: 'pdf' | 'xrechnung';
  buyer: OfficeInvoiceRecipient;
  buyerConfirmed: boolean;
  buyerCountryCode: string;
  buyerVatId: string;
  buyerLegalRegistrationId: string;
  buyerReference: string;
  buyerEndpoint: OfficeEInvoiceEndpoint;
  sellerIdentifier: string;
  sellerCountryCode: string;
  sellerEndpoint: OfficeEInvoiceEndpoint;
  sellerContact: { name: string; phone: string; email: string };
  legal: {
    recipientKind: 'unknown' | 'b2b' | 'b2c' | 'b2g';
    buyerBusinessUse: OfficeEInvoiceAnswer;
    sellerDomestic: OfficeEInvoiceAnswer;
    buyerDomestic: OfficeEInvoiceAnswer;
    sellerSmallBusiness: OfficeEInvoiceAnswer;
    smallAmountRuleEligible: OfficeEInvoiceAnswer;
    passengerTicket: OfficeEInvoiceAnswer;
    transmissionDate: string;
    priorYearRevenueCents: number | null;
    priorYearRevenueYear: number | null;
    pdfConsent: OfficeEInvoiceAnswer;
  };
};
export type OfficeEInvoiceDraftLine = OfficeInvoiceDraftLine & { eInvoiceTax?: OfficeEInvoiceLineTax };
export type OfficeEInvoiceFinding = { code: string; message: string; field?: string };
export type OfficeEInvoiceAssessment = {
  status: 'review' | 'not_required' | 'transition' | 'required';
  label: string;
  reasons: string[];
  /** null means the facts do not support a decision; this is not an automatic tax opinion. */
  pdfPermitted: boolean | null;
  consentMissing: boolean;
};
export type OfficeEInvoiceAttachment = { id: string; fileName: string; description: string; mimeType: 'application/pdf'; base64: string };
export type OfficeEInvoiceTaxGroup = { category: OfficeEInvoiceTaxCategory; ratePercent: number | null; exemptionReason: string; exemptionReasonCode: string; netCents: number; taxCents: number };
