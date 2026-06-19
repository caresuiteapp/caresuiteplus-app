import type { EntityId, ISODateTime } from '@/types/core/base';

export type TenantModuleKey = 'assist' | 'pflege' | 'stationaer' | 'beratung';
export type ServiceCatalogCategory = 'service' | 'travel' | 'surcharge';
export type ServicePriceUnit = 'hour' | 'visit' | 'day' | 'flat' | 'km' | 'percent';
export type ServiceTaxMode = 'exempt_4_16' | 'standard_19' | 'kleinunternehmer_19' | 'none';
export type CustomFieldDataType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiline';
export type SectionCompleteness = 'complete' | 'partial' | 'empty';

export type TenantCompanyProfile = {
  name: string;
  legalName: string;
  legalForm: string;
  industry: string;
  street: string;
  houseNumber: string;
  zip: string;
  city: string;
  country: string;
  phone: string;
  fax: string;
  email: string;
  website: string;
  notes: string;
};

export type TenantLegalProfile = {
  liabilityInsurance: string;
  liabilityInsurer: string;
  liabilityPolicyNumber: string;
  chamberMembership: string;
  professionalAssociation: string;
  legalNotes: string;
};

export type TenantTaxProfile = {
  taxNumber: string;
  vatId: string;
  taxOffice: string;
  kleinunternehmer: boolean;
  taxScheme: 'standard' | 'kleinunternehmer' | 'exempt';
  reverseCharge: boolean;
  taxNotes: string;
};

export type TenantRegisterProfile = {
  registerCourt: string;
  registerNumber: string;
  registerType: string;
  registerDate: string;
  shareCapital: string;
  registerNotes: string;
  ikNumber: string;
  supervisoryAuthority: string;
};

export type TenantContactCommunication = {
  billingEmail: string;
  supportEmail: string;
  supportPhone: string;
  contactPersons: TenantContactPerson[];
};

export type TenantContactPerson = {
  id?: EntityId;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
  isPrimary: boolean;
};

export type TenantRepresentative = {
  id?: EntityId;
  salutation: string;
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type TenantBankAccount = {
  id?: EntityId;
  label: string;
  accountHolder: string;
  bankName: string;
  iban: string;
  bic: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type TenantPaymentTerms = {
  paymentTermsDays: string;
  dunningAfterDays: string;
  dunningFee: string;
  invoicePrefix: string;
  invoiceFooterText: string;
  invoiceNotes: string;
};

export type TenantBrandingProfile = {
  logoUrl: string;
  appName: string;
  primaryColor: string;
  accentColor: string;
};

export type TenantModuleSettings = {
  assistEnabled: boolean;
  pflegeEnabled: boolean;
  stationaerEnabled: boolean;
  beratungEnabled: boolean;
};

export type TenantServiceCatalogItem = {
  id: EntityId;
  moduleKey: TenantModuleKey;
  serviceKey: string;
  name: string;
  description: string;
  unit: ServicePriceUnit;
  category: ServiceCatalogCategory;
  isActive: boolean;
  sortOrder: number;
  defaultPriceNet: number | null;
  defaultTaxMode: ServiceTaxMode | null;
};

export type TenantServicePrice = {
  id: EntityId;
  catalogId: EntityId;
  priceNet: number;
  taxRate: number;
  taxMode: ServiceTaxMode;
  validFrom: string;
  validTo: string | null;
  isDefault: boolean;
};

export type TenantCustomFieldDefinition = {
  id?: EntityId;
  groupId: EntityId | null;
  fieldKey: string;
  label: string;
  dataType: CustomFieldDataType;
  moduleKey: TenantModuleKey | null;
  functionKey: string | null;
  visibility: Record<string, unknown>;
  validation: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
};

export type TenantAuditLogEntry = {
  id: EntityId;
  action: string;
  title: string | null;
  description: string | null;
  tableName: string | null;
  createdAt: ISODateTime;
};

export type TenantCenterSectionKey =
  | 'company'
  | 'legal'
  | 'tax'
  | 'register'
  | 'contact'
  | 'representatives'
  | 'bank'
  | 'payment'
  | 'branding'
  | 'modules'
  | 'catalog'
  | 'customFields'
  | 'audit'
  | 'supervisory'
  | 'locations'
  | 'documentLayout'
  | 'ikNumbers'
  | 'travelSurcharges';

export type TenantCenterSectionMeta = {
  key: TenantCenterSectionKey;
  title: string;
  description: string;
  completeness: SectionCompleteness;
  summary: string;
  editable: boolean;
  stub?: boolean;
};

export type TenantCenterSnapshot = {
  tenantId: EntityId;
  updatedAt: ISODateTime;
  company: TenantCompanyProfile;
  legal: TenantLegalProfile;
  tax: TenantTaxProfile;
  register: TenantRegisterProfile;
  contact: TenantContactCommunication;
  representatives: TenantRepresentative[];
  bankAccounts: TenantBankAccount[];
  payment: TenantPaymentTerms;
  branding: TenantBrandingProfile;
  modules: TenantModuleSettings;
  catalogSummary: string;
  catalogItems: TenantServiceCatalogItem[];
  customFields: TenantCustomFieldDefinition[];
  auditLogs: TenantAuditLogEntry[];
  sections: TenantCenterSectionMeta[];
  assistDefaultHourlyRate: string;
};

export const EMPTY_TENANT_COMPANY: TenantCompanyProfile = {
  name: '',
  legalName: '',
  legalForm: '',
  industry: '',
  street: '',
  houseNumber: '',
  zip: '',
  city: '',
  country: 'Deutschland',
  phone: '',
  fax: '',
  email: '',
  website: '',
  notes: '',
};

export const EMPTY_TENANT_LEGAL: TenantLegalProfile = {
  liabilityInsurance: '',
  liabilityInsurer: '',
  liabilityPolicyNumber: '',
  chamberMembership: '',
  professionalAssociation: '',
  legalNotes: '',
};

export const EMPTY_TENANT_TAX: TenantTaxProfile = {
  taxNumber: '',
  vatId: '',
  taxOffice: '',
  kleinunternehmer: false,
  taxScheme: 'standard',
  reverseCharge: false,
  taxNotes: '',
};

export const EMPTY_TENANT_REGISTER: TenantRegisterProfile = {
  registerCourt: '',
  registerNumber: '',
  registerType: '',
  registerDate: '',
  shareCapital: '',
  registerNotes: '',
  ikNumber: '',
  supervisoryAuthority: '',
};

export const EMPTY_TENANT_PAYMENT: TenantPaymentTerms = {
  paymentTermsDays: '14',
  dunningAfterDays: '14',
  dunningFee: '',
  invoicePrefix: '',
  invoiceFooterText: '',
  invoiceNotes: '',
};

export const EMPTY_TENANT_BRANDING: TenantBrandingProfile = {
  logoUrl: '',
  appName: '',
  primaryColor: '',
  accentColor: '',
};

export const DEFAULT_TENANT_MODULES: TenantModuleSettings = {
  assistEnabled: true,
  pflegeEnabled: false,
  stationaerEnabled: false,
  beratungEnabled: false,
};
