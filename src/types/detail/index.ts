import type { WorkflowStatus } from '../core/base';
import type { DataVisibilityScope, SensitivityLevel } from '../portal/visibility';
import type { Client } from '../modules/office';

export type AuditEntry = {
  id: string;
  action: string;
  actorName: string;
  timestamp: string;
  details?: string;
};

export type ClientContact = {
  id: string;
  name: string;
  relationship: string;
  phone: string | null;
  email: string | null;
  isEmergency: boolean;
};

export type ClientConsent = {
  id: string;
  title: string;
  scope: DataVisibilityScope;
  granted: boolean;
  grantedAt: string | null;
  expiresAt: string | null;
};

export type ClientContextCounts = {
  assignments: number;
  documents: number;
  invoices: number;
  appointments: number;
};

export type ClientHistoryEntry = {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  timestamp: string;
  status: WorkflowStatus;
  actorName?: string;
};

export type ClientDetail = Client & {
  street: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  contacts: ClientContact[];
  consents: ClientConsent[];
  auditEntries: AuditEntry[];
  history: ClientHistoryEntry[];
  contextCounts: ClientContextCounts;
  nextActionHint: string;
  allowedStatusActions: WorkflowStatus[];
};
