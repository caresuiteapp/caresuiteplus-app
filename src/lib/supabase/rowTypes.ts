import type { WorkflowStatus } from '@/types/core/base';
import type { RoleKey } from '@/types/core/auth';

/** App-level row shapes (local migrations / joined queries). May diverge from remote Database types. */

export type WorkflowStatusDb = WorkflowStatus;

export type ClientRow = {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  status: WorkflowStatus | string;
  care_level: string | null;
  city: string | null;
  zip: string | null;
  postal_code?: string | null;
  cost_bearer?: string | null;
  insurance_number?: string | null;
  insurance_name?: string | null;
  internal_notes?: string | null;
  notes?: string | null;
  archived_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  sensitivity: string | null;
  updated_at: string;
};

export type ClientContactRow = {
  id: string;
  tenant_id?: string;
  client_id?: string;
  name?: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  is_emergency?: boolean;
  is_emergency_contact?: boolean | null;
  contact_type?: string | null;
  created_at?: string;
};

export type ClientConsentRow = {
  id: string;
  tenant_id?: string;
  client_id?: string;
  title: string;
  scope: string;
  granted: boolean;
  granted_at: string | null;
  expires_at: string | null;
  created_at?: string;
};

export type ClientAuditRow = {
  id: string;
  action: string;
  actor_name: string | null;
  created_at: string;
  details: string | null;
};

export type ClientHistoryRow = {
  id: string;
  icon: string;
  title: string;
  subtitle: string | null;
  created_at: string;
  status: WorkflowStatus;
  actor_name: string | null;
};

export type ClientDetailRow = ClientRow & {
  created_at: string;
  date_of_birth: string | null;
  admission_date?: string | null;
  primary_contact_phone: string | null;
  street: string | null;
  house_number?: string | null;
  mobile?: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  visibility: string | null;
  owned_by_profile_id: string | null;
  shared_with_profile_ids: string[] | null;
  client_contacts?: ClientContactRow[];
  client_consents?: ClientConsentRow[];
  client_audit_entries?: ClientAuditRow[];
  client_history_entries?: ClientHistoryRow[];
};

export type ClientExtendedRow = {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  salutation?: string | null;
  gender?: string | null;
  date_of_birth: string | null;
  lifecycle_status?: string | null;
  insurance_number?: string | null;
  key_safe_code?: string | null;
  diagnoses?: unknown;
  primary_contact_phone: string | null;
  city: string | null;
  zip: string | null;
  postal_code?: string | null;
  sensitivity: string | null;
  visibility: string | null;
  owned_by_profile_id?: string | null;
  shared_with_profile_ids?: string[] | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
};

export type ClientInsert = {
  tenant_id?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string | null;
  care_level?: string | null;
  status?: WorkflowStatus;
  street?: string | null;
  city?: string | null;
  zip?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  sensitivity?: string | null;
  visibility?: string | null;
  updated_at?: string;
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
