/** Vertragsvorlagen — Typen für Validierung und Lebenszyklus */

export type ContractTypeKey =
  | 'kundenvertrag'
  | 'betreuungsvertrag'
  | 'selbstzahlervertrag'
  | 'abtretungserklaerung'
  | 'vollmacht'
  | 'datenschutz_einwilligung'
  | 'schweigepflichtentbindung'
  | 'dienstleistungsvertrag'
  | 'mitarbeitervertrag'
  | 'auftragnehmervertrag';

export type ContractDocumentStatus =
  | 'draft'
  | 'finalized'
  | 'correction'
  | 'cancellation'
  | 'render_failed';

export type ContractParty = {
  name: string;
  street: string;
  zip: string;
  city: string;
};

export type ContractSignatureFields = {
  companySigned: boolean;
  clientSigned: boolean;
  legalRepSigned: boolean;
  employeeSigned: boolean;
  companySignedAt: string | null;
  clientSignedAt: string | null;
  legalRepSignedAt: string | null;
  employeeSignedAt: string | null;
};

export type ContractRecord = {
  id: string;
  tenantId: string;
  contractType: ContractTypeKey;
  contractNumber: string | null;
  status: ContractDocumentStatus;
  contractDate: string;
  logoUrl: string | null;
  partyA: ContractParty;
  partyB: ContractParty;
  companyData: ContractParty & { legalName: string; taxId: string; ikNumber: string };
  clientData: ContractParty & { customerNumber: string; careLevel: string };
  legalRepresentative: ContractParty | null;
  serviceDescription: string;
  compensation: string;
  hourlyRate: string;
  billingType: string;
  paymentTerms: string;
  termStart: string;
  termEnd: string;
  noticePeriod: string;
  privacySection: string;
  confidentialityConsents: string;
  liabilityClause: string;
  finalProvisions: string;
  placeAndDate: string;
  signatures: ContractSignatureFields;
  lockedAt: string | null;
  correctedFromContractId: string | null;
  cancelledFromContractId: string | null;
  lifecycleDocumentId: string | null;
  previewConfirmed: boolean;
  contentHash: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ContractAuditEventType =
  | 'contract_created'
  | 'contract_validated'
  | 'contract_validation_failed'
  | 'contract_finalized'
  | 'contract_locked'
  | 'contract_edit_blocked'
  | 'contract_correction_created'
  | 'contract_cancellation_created'
  | 'contract_number_assigned';

export type ContractAuditEvent = {
  id: string;
  tenantId: string;
  contractId: string;
  eventType: ContractAuditEventType;
  summary: string;
  metadata?: Record<string, string>;
  createdAt: string;
};

export const CONTRACT_TYPE_LABELS: Record<ContractTypeKey, string> = {
  kundenvertrag: 'Kundenvertrag',
  betreuungsvertrag: 'Betreuungsvertrag',
  selbstzahlervertrag: 'Selbstzahlervertrag',
  abtretungserklaerung: 'Abtretungserklärung',
  vollmacht: 'Vollmacht',
  datenschutz_einwilligung: 'Datenschutz-Einwilligung',
  schweigepflichtentbindung: 'Schweigepflichtentbindung',
  dienstleistungsvertrag: 'Dienstleistungsvertrag',
  mitarbeitervertrag: 'Mitarbeitervertrag',
  auftragnehmervertrag: 'Auftragnehmervertrag',
};

/** Vertragstypen, bei denen Vergütung/Stundensatz Pflicht ist */
export const CONTRACT_TYPES_REQUIRING_COMPENSATION: ContractTypeKey[] = [
  'kundenvertrag',
  'betreuungsvertrag',
  'selbstzahlervertrag',
  'dienstleistungsvertrag',
  'mitarbeitervertrag',
  'auftragnehmervertrag',
];

export const CONTRACT_DISCLAIMER =
  'Vertragsvorlagen sind strukturell vorbereitet — keine Rechtsberatung oder Garantie für rechtliche Wirksamkeit.';
