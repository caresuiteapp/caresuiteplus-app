import type { DocumentTemplateTypeKey } from '@/features/documents/templateEngine/types';

/** Layoutbereiche laut Geschäftsdokument-Spezifikation */
export type DocumentLayoutArea =
  | 'page_header'
  | 'sender_line'
  | 'address_field'
  | 'info_block'
  | 'subject_line'
  | 'document_body'
  | 'table_area'
  | 'legal_notice_area'
  | 'signature_area'
  | 'attachments_area'
  | 'footer'
  | 'page_break_control';

export type LogoPosition = 'left' | 'center' | 'right';

export type HeaderLayoutConfig = {
  logoPosition: LogoPosition;
  showCompanyName: boolean;
  showBrandLine: boolean;
  showSlogan: boolean;
  showDocumentType: boolean;
  showAccentLine: boolean;
  showDocumentNumber: boolean;
  showPageNumber: boolean;
  contactPersonName?: string;
  contactPersonEmail?: string;
  contactPersonPhone?: string;
};

export type FooterDocumentTypeConfig = {
  enabled: boolean;
  customText?: string;
  showBankDetails: boolean;
  bankRequired: boolean;
  showMandatoryDisclosures: boolean;
};

export type FooterLayoutConfig = {
  showPageNumber: boolean;
  showMandatoryDisclosures: boolean;
  byDocumentType: Partial<Record<DocumentTemplateTypeKey, FooterDocumentTypeConfig>>;
};

export type PageLayoutConfig = {
  format: 'A4';
  orientation: 'portrait';
  widthMm: number;
  heightMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  baseFontSizePt: number;
  headingFontSizePt: number;
  lineHeight: number;
  fontFamily: string;
};

export type TenantDocumentSettings = {
  id: string;
  tenantId: string;
  logoUrl: string | null;
  logoWidthMm: number;
  logoNaturalWidthPx: number | null;
  logoNaturalHeightPx: number | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  headerLayout: HeaderLayoutConfig;
  footerLayout: FooterLayoutConfig;
  pageLayout: PageLayoutConfig;
  defaultPaymentTermsDays: number;
  defaultTaxNotice: string;
  defaultContractClauses: string;
  defaultDunningTerms: string;
  defaultDocumentLanguage: string;
  bankName: string;
  iban: string;
  bic: string;
  /** Wenn aktiv: Finalisierung ohne vollständige CI blockieren */
  ciEnforcementEnabled: boolean;
  updatedAt: string;
};

export type TenantDocumentSettingsForm = Omit<
  TenantDocumentSettings,
  'id' | 'tenantId' | 'updatedAt'
>;

export type InvoiceRecipientKind = 'guardian' | 'cost_carrier' | 'self_payer' | 'custom';

export type InvoiceRecipientInput = {
  kind: InvoiceRecipientKind;
  client: {
    full_name?: string;
    street?: string;
    zip?: string;
    city?: string;
    billing_address?: string;
  };
  representative?: {
    full_name?: string;
    street?: string;
    zip?: string;
    city?: string;
    is_invoice_recipient?: boolean;
  };
  cost_carrier?: {
    name?: string;
    street?: string;
    zip?: string;
    city?: string;
  };
  custom?: {
    full_name?: string;
    street?: string;
    zip?: string;
    city?: string;
  };
};
