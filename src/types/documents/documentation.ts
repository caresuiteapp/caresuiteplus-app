/** Dokumentationsvorlagen — Typen für Validierung und Lebenszyklus */

export type DocumentationTypeKey =
  | 'einsatzdokumentation'
  | 'alltagsbegleitung'
  | 'hauswirtschaft'
  | 'betreuung'
  | 'pflegeberatung'
  | 'erstgespraech'
  | 'risikoerfassung'
  | 'ereignisprotokoll'
  | 'notfallprotokoll'
  | 'beschwerdeprotokoll'
  | 'uebergabebericht'
  | 'besuchsbericht'
  | 'beratungsprotokoll'
  | 'wunddokumentation'
  | 'vitalwerteprotokoll'
  | 'medikationshinweis';

export type DocumentationDocumentStatus =
  | 'draft'
  | 'finalized'
  | 'correction'
  | 'render_failed';

export type DocumentationAuditStatus = 'pending' | 'reviewed' | 'approved';

export type DocumentationRecord = {
  id: string;
  tenantId: string;
  documentationType: DocumentationTypeKey;
  documentNumber: string | null;
  status: DocumentationDocumentStatus;
  documentDate: string;
  documentTime: string;
  clientName: string;
  clientId: string;
  employeeName: string;
  occasion: string;
  observation: string;
  measure: string;
  result: string;
  specialNotes: string;
  risks: string;
  referralRequired: boolean;
  referralRecipient: string;
  contentText: string;
  digitalSignature: string | null;
  signedAt: string | null;
  auditStatus: DocumentationAuditStatus;
  lockedAt: string | null;
  contentHash: string | null;
  lifecycleDocumentId: string | null;
  previewConfirmed: boolean;
  version: number;
  correctedFromDocumentationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentationAuditEventType =
  | 'documentation_created'
  | 'documentation_validated'
  | 'documentation_validation_failed'
  | 'documentation_finalized'
  | 'documentation_locked'
  | 'documentation_edit_blocked'
  | 'documentation_correction_created';

export type DocumentationAuditEvent = {
  id: string;
  tenantId: string;
  documentationId: string;
  eventType: DocumentationAuditEventType;
  summary: string;
  metadata?: Record<string, string>;
  createdAt: string;
};

export const DOCUMENTATION_TYPE_LABELS: Record<DocumentationTypeKey, string> = {
  einsatzdokumentation: 'Einsatzdokumentation',
  alltagsbegleitung: 'Alltagsbegleitung',
  hauswirtschaft: 'Hauswirtschaft',
  betreuung: 'Betreuung',
  pflegeberatung: 'Pflegeberatung',
  erstgespraech: 'Erstgespräch',
  risikoerfassung: 'Risikoerfassung',
  ereignisprotokoll: 'Ereignisprotokoll',
  notfallprotokoll: 'Notfallprotokoll',
  beschwerdeprotokoll: 'Beschwerdeprotokoll',
  uebergabebericht: 'Übergabebericht',
  besuchsbericht: 'Besuchsbericht',
  beratungsprotokoll: 'Beratungsprotokoll',
  wunddokumentation: 'Wunddokumentation',
  vitalwerteprotokoll: 'Vitalwerteprotokoll',
  medikationshinweis: 'Medikationshinweis',
};

/** Vorlagen mit vorbereitetem Status — noch nicht produktiv */
export const DOCUMENTATION_PREPARED_TYPES: DocumentationTypeKey[] = [
  'wunddokumentation',
  'vitalwerteprotokoll',
  'medikationshinweis',
];

/** Notfallprotokoll erfordert Anlass und Beschreibung */
export const DOCUMENTATION_TYPES_REQUIRING_OCCASION: DocumentationTypeKey[] = [
  'notfallprotokoll',
  'ereignisprotokoll',
  'beschwerdeprotokoll',
];

export const DOCUMENTATION_DISCLAIMER =
  'Dokumentationsvorlagen sind strukturell vorbereitet — keine medizinische oder rechtliche Garantie.';
