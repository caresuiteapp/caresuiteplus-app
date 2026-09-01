import type { EntityId, ISODateTime } from '@/types/core/base';

export type ClientTerminationKind =
  | 'ordinary_by_client'
  | 'ordinary_by_provider'
  | 'extraordinary_by_client'
  | 'extraordinary_by_provider'
  | 'mutual_agreement'
  | 'contract_end'
  | 'transfer'
  | 'deceased';

export const CLIENT_TERMINATION_KIND_LABELS: Record<ClientTerminationKind, string> = {
  ordinary_by_client: 'Ordentliche Kündigung durch Klient:in',
  ordinary_by_provider: 'Ordentliche Kündigung durch Leistungserbringer',
  extraordinary_by_client: 'Außerordentliche Kündigung durch Klient:in',
  extraordinary_by_provider: 'Außerordentliche Kündigung durch Leistungserbringer',
  mutual_agreement: 'Aufhebungsvereinbarung',
  contract_end: 'Vertragsende',
  transfer: 'Wechsel des Leistungserbringers',
  deceased: 'Verstorben',
};

export type ClientOffboardingStatus =
  | 'draft'
  | 'in_progress'
  | 'blocked'
  | 'ready_for_clearance'
  | 'completed'
  | 'reopened';

export type ClientPortalClosureMode = 'effective_date' | 'immediate' | 'read_only_grace';

export type ClientOffboardingCase = {
  id: EntityId;
  tenantId: EntityId;
  clientId: EntityId;
  status: ClientOffboardingStatus;
  terminationKind: ClientTerminationKind | null;
  noticeDate: string | null;
  effectiveDate: string | null;
  lastServiceDate: string | null;
  reasonCategory: string | null;
  internalReason: string | null;
  externalReason: string | null;
  portalClosureMode: ClientPortalClosureMode;
  portalGraceUntil: ISODateTime | null;
  legalHold: boolean;
  finalProtocol: Record<string, unknown> | null;
  responsibleUserId: EntityId | null;
  startedAt: ISODateTime | null;
  completedAt: ISODateTime | null;
  archivedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type ClientOffboardingCheckKey =
  | 'termination_details'
  | 'open_assignments'
  | 'open_documentation'
  | 'open_signatures'
  | 'open_billing'
  | 'open_refunds'
  | 'open_messages'
  | 'portal_access'
  | 'push_devices'
  | 'documents_export'
  | 'stakeholder_notifications'
  | 'final_protocol';

export type ClientOffboardingCheck = {
  id: EntityId;
  caseId: EntityId;
  tenantId: EntityId;
  clientId: EntityId;
  checkKey: ClientOffboardingCheckKey;
  status: 'passed' | 'warning' | 'failed';
  severity: 'required' | 'review';
  message: string;
  objectCount: number;
  details: Record<string, unknown>;
  evaluatedAt: ISODateTime;
};

export type ClientOffboardingActionKey =
  | 'reassign_or_cancel_assignments'
  | 'complete_documentation'
  | 'collect_or_defer_signatures'
  | 'prepare_final_billing'
  | 'notify_client_or_representative'
  | 'notify_cost_bearer'
  | 'notify_authority_if_required'
  | 'export_case_documents'
  | 'lock_portal_access'
  | 'create_final_protocol'
  | 'archive_client_record';

export type ClientOffboardingAction = {
  id: EntityId;
  caseId: EntityId;
  tenantId: EntityId;
  clientId: EntityId;
  actionKey: ClientOffboardingActionKey;
  status: 'pending' | 'in_progress' | 'completed' | 'not_applicable' | 'blocked';
  notes: string | null;
  completedAt: ISODateTime | null;
  completedBy: EntityId | null;
  updatedAt: ISODateTime;
};

export type ClientOffboardingSummary = {
  clientName: string;
  case: ClientOffboardingCase;
  checks: ClientOffboardingCheck[];
  actions: ClientOffboardingAction[];
  hardBlockers: ClientOffboardingCheck[];
  warningChecks: ClientOffboardingCheck[];
  progressPercent: number;
  portalLocked: boolean;
};

export const CLIENT_OFFBOARDING_ACTION_LABELS: Record<ClientOffboardingActionKey, string> = {
  reassign_or_cancel_assignments: 'Zukünftige Einsätze beenden oder neu zuordnen',
  complete_documentation: 'Dokumentationen vollständig abschließen',
  collect_or_defer_signatures: 'Unterschriften abschließen oder ins Klientenportal geben',
  prepare_final_billing: 'Schlussabrechnung und offene Forderungen prüfen',
  notify_client_or_representative: 'Klient:in bzw. Vertretung nachweisbar informieren',
  notify_cost_bearer: 'Kostenträger informieren',
  notify_authority_if_required: 'Meldepflicht an zuständige Stelle prüfen',
  export_case_documents: 'Vollständigen Aktenexport erzeugen',
  lock_portal_access: 'Portalzugang fristgerecht sperren',
  create_final_protocol: 'Abschlussprotokoll erzeugen',
  archive_client_record: 'Klient:innenakte archivieren',
};
