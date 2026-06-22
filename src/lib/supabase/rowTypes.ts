import type { RoleKey } from '@/types/core/auth';
import type { WorkflowStatus } from '@/types/core/base';
import type { Database } from './types';

type Tables = Database['public']['Tables'];

/** App-level alias for DB workflow strings where needed outside generated enums. */
export type WorkflowStatusDb = WorkflowStatus;

export type ClientRow = Tables['clients']['Row'];
export type ClientInsert = Tables['clients']['Insert'];
export type ClientUpdate = Tables['clients']['Update'];

export type ClientContactRow = Tables['client_contacts']['Row'];
export type ClientConsentRow = Tables['client_consents']['Row'];
export type ClientAuditRow = Tables['client_audit_entries']['Row'];
export type ClientHistoryRow = Tables['client_history_entries']['Row'];
export type ClientTaskRow = Tables['client_tasks']['Row'];
export type ClientAddressRow = Tables['client_addresses']['Row'];
export type ClientDocumentRow = Tables['client_documents']['Row'];

/** Joined client detail from list/detail queries (base row + nested relations). */
export type ClientDetailRow = ClientRow & {
  client_contacts?: ClientContactRow[];
  client_consents?: ClientConsentRow[];
  client_audit_entries?: ClientAuditRow[];
  client_history_entries?: ClientHistoryRow[];
};

/**
 * Extended client row for full-record queries.
 * Optional fields cover joined/computed values not always present on `clients.Row`.
 */
export type ClientExtendedRow = ClientRow & {
  lifecycle_status?: string | null;
  salutation?: string | null;
  key_safe_code?: string | null;
  diagnoses?: unknown;
  primary_contact_phone?: string | null;
  zip?: string | null;
  sensitivity?: string | null;
  visibility?: string | null;
  owned_by_profile_id?: string | null;
  shared_with_profile_ids?: string[] | null;
};

export type EmployeeRow = {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  status: string;
  [key: string]: unknown;
};

export type ProfileRow = {
  id: string;
  tenant_id: string | null;
  role_id: string | null;
  role_key: RoleKey | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};
