import type { ClientDetail } from '@/types/detail';
import type {
  ClientAddress,
  ClientBillingProfile,
  ClientBudget,
  ClientCareLevel,
  ClientConsentRecord,
  ClientContactRecord,
  ClientContract,
  ClientDocumentRecord,
  ClientFullDetail,
  ClientInternalNote,
  ClientPortalAccess,
  ClientRisk,
  ClientTask,
  ClientTimelineEvent,
  ClientCore,
  ClientLifecycleStatus,
  ClientGender,
  ContactRelation,
  ConsentType,
} from '@/types/modules/client';
import type { DataVisibilityScope, SensitivityLevel } from '@/types/portal/visibility';
import { mapClientDetail } from './clientMapper';
import { mergeClientRecordDocuments } from '@/lib/clients/clientDocumentMerge';
import type { WorkflowStatus } from '@/types/core/base';
import type {
  ClientAuditRow,
  ClientConsentRow,
  ClientContactRow,
  ClientDetailRow,
  ClientExtendedRow,
  ClientHistoryRow,
} from '../rowTypes';

const DEFAULT_PORTAL_PERMISSIONS = {
  canViewAppointments: false,
  canViewDocuments: false,
  canViewCarePlan: false,
  canSendMessages: false,
  canViewBilling: false,
};

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

function parsePortalPermissions(value: unknown): ClientContactRecord['portalPermissions'] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return {
      canViewAppointments: Boolean(record.canViewAppointments),
      canViewDocuments: Boolean(record.canViewDocuments),
      canViewCarePlan: Boolean(record.canViewCarePlan),
      canSendMessages: Boolean(record.canSendMessages),
      canViewBilling: Boolean(record.canViewBilling),
    };
  }
  return DEFAULT_PORTAL_PERMISSIONS;
}

function parseRelationship(value: string): ContactRelation {
  const known: ContactRelation[] = [
    'angehoerige',
    'ehepartner',
    'kind',
    'nachbar',
    'betreuer',
    'arzt',
    'sonstige',
  ];
  return known.includes(value as ContactRelation) ? (value as ContactRelation) : 'sonstige';
}

function splitContactName(row: ClientContactRow & { first_name?: string | null; last_name?: string | null }) {
  if (row.first_name || row.last_name) {
    return {
      firstName: row.first_name?.trim() || row.name.split(' ')[0] || row.name,
      lastName: row.last_name?.trim() || row.name.split(' ').slice(1).join(' ') || '',
    };
  }
  const parts = row.name.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? row.name,
    lastName: parts.slice(1).join(' ') || '',
  };
}

export function mapClientContactExtended(
  row: ClientContactRow & {
    first_name?: string | null;
    last_name?: string | null;
    is_portal_user?: boolean;
    portal_permissions?: unknown;
    notes?: string | null;
    updated_at?: string;
  },
): ClientContactRecord {
  const { firstName, lastName } = splitContactName(row);
  return {
    id: row.id,
    tenantId: row.tenant_id ?? '',
    clientId: row.client_id ?? '',
    firstName,
    lastName,
    relationship: parseRelationship(row.relationship ?? ''),
    relationshipLabel: row.relationship ?? '',
    phone: row.phone,
    email: row.email,
    isEmergency: row.is_emergency,
    isPortalUser: row.is_portal_user ?? false,
    portalPermissions: parsePortalPermissions(row.portal_permissions),
    notes: row.notes ?? null,
    createdAt: row.created_at ?? row.updated_at ?? '',
    updatedAt: row.updated_at ?? row.created_at ?? '',
  };
}

export function mapClientConsentExtended(
  row: ClientConsentRow & {
    consent_type?: ConsentType | null;
    granted_by_profile_id?: string | null;
    document_id?: string | null;
    notes?: string | null;
    updated_at?: string;
  },
): ClientConsentRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id ?? '',
    clientId: row.client_id ?? '',
    consentType: row.consent_type ?? 'datenschutz',
    title: row.title,
    scope: row.scope as DataVisibilityScope,
    granted: row.granted,
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
    grantedByProfileId: row.granted_by_profile_id ?? null,
    documentId: row.document_id ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at ?? row.granted_at ?? '',
    updatedAt: row.updated_at ?? row.created_at ?? row.granted_at ?? '',
  };
}

export function mapClientCore(row: ClientExtendedRow): ClientCore {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    firstName: row.first_name,
    lastName: row.last_name,
    salutation: row.salutation ?? null,
    gender: (row.gender as ClientGender | null) ?? null,
    dateOfBirth: row.date_of_birth,
    lifecycleStatus: (row.lifecycle_status as ClientLifecycleStatus) ?? 'aktiv',
    insuranceNumber: row.insurance_number ?? null,
    keySafeCode: row.key_safe_code ?? null,
    diagnoses: parseStringArray(row.diagnoses),
    primaryContactPhone: row.primary_contact_phone,
    city: row.city,
    zip: row.zip,
    sensitivity: (row.sensitivity ?? 'standard') as SensitivityLevel,
    visibility: (row.visibility ?? 'team') as DataVisibilityScope,
    ownedByProfileId: row.owned_by_profile_id ?? undefined,
    sharedWithProfileIds: row.shared_with_profile_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type AddressRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  address_type: ClientAddress['addressType'];
  street: string;
  zip: string;
  city: string;
  country: string;
  is_primary: boolean;
  access_notes: string | null;
  floor: string | null;
  door_code: string | null;
  created_at: string;
  updated_at: string;
};

export function mapClientAddress(row: AddressRow): ClientAddress {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    addressType: row.address_type,
    street: row.street,
    zip: row.zip,
    city: row.city,
    country: row.country,
    isPrimary: row.is_primary,
    accessNotes: row.access_notes,
    floor: row.floor,
    doorCode: row.door_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type CareLevelRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  grade: ClientCareLevel['grade'];
  valid_from: string;
  valid_until: string | null;
  care_fund_name: string;
  care_fund_member_id: string | null;
  md_assessment_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function mapClientCareLevel(row: CareLevelRow): ClientCareLevel {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    grade: row.grade,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    careFundName: row.care_fund_name,
    careFundMemberId: row.care_fund_member_id,
    mdAssessmentDate: row.md_assessment_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type BudgetRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  budget_type: ClientBudget['budgetType'];
  year: number;
  total_amount_cents: number;
  used_amount_cents: number;
  reserved_amount_cents: number;
  valid_from: string;
  valid_until: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function mapClientBudget(row: BudgetRow): ClientBudget {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    budgetType: row.budget_type,
    year: row.year,
    totalAmountCents: row.total_amount_cents,
    usedAmountCents: row.used_amount_cents,
    reservedAmountCents: row.reserved_amount_cents,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type BillingProfileRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  billing_type: ClientBillingProfile['billingType'];
  hourly_rate_cents: number;
  service_type: ClientBillingProfile['serviceType'];
  invoice_recipient: string | null;
  payment_terms_days: number;
  cost_bearer_name: string | null;
  cost_bearer_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function mapClientBillingProfile(row: BillingProfileRow): ClientBillingProfile {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    billingType: row.billing_type,
    hourlyRateCents: row.hourly_rate_cents,
    serviceType: row.service_type,
    invoiceRecipient: row.invoice_recipient,
    paymentTermsDays: row.payment_terms_days,
    costBearerName: row.cost_bearer_name,
    costBearerReference: row.cost_bearer_reference,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type ContractRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  contract_number: string;
  contract_start: string;
  contract_end: string | null;
  service_type: ClientContract['serviceType'];
  hourly_rate_cents: number;
  weekly_hours: number | null;
  status: ClientContract['status'];
  signed_at: string | null;
  document_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function mapClientContract(row: ContractRow): ClientContract {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    contractNumber: row.contract_number,
    contractStart: row.contract_start,
    contractEnd: row.contract_end,
    serviceType: row.service_type,
    hourlyRateCents: row.hourly_rate_cents,
    weeklyHours: row.weekly_hours,
    status: row.status,
    signedAt: row.signed_at,
    documentId: row.document_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type DocumentRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  title: string;
  file_name: string;
  mime_type: string;
  category: ClientDocumentRecord['category'];
  storage_path: string | null;
  status: ClientDocumentRecord['status'];
  sensitivity: ClientDocumentRecord['sensitivity'];
  uploaded_by: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
};

export function mapClientDocument(row: DocumentRow): ClientDocumentRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    title: row.title,
    fileName: row.file_name,
    mimeType: row.mime_type,
    category: row.category,
    storagePath: row.storage_path,
    status: row.status,
    sensitivity: row.sensitivity,
    uploadedBy: row.uploaded_by,
    validUntil: row.valid_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type NoteRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  content: string;
  is_internal: boolean;
  category: ClientInternalNote['category'];
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function mapClientInternalNote(row: NoteRow): ClientInternalNote {
  return {
    id: row.id,
    clientId: row.client_id,
    tenantId: row.tenant_id,
    content: row.content,
    isInternal: true,
    createdBy: row.created_by ?? 'System',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    category: row.category,
  };
}

type RiskRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  category: ClientRisk['category'];
  level: ClientRisk['level'];
  description: string;
  mitigation: string | null;
  assessed_at: string;
  assessed_by: string | null;
  created_at: string;
  updated_at: string;
};

export function mapClientRisk(row: RiskRow): ClientRisk {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    category: row.category,
    level: row.level,
    description: row.description,
    mitigation: row.mitigation,
    assessedAt: row.assessed_at,
    assessedBy: row.assessed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type PortalAccessRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  contact_id: string | null;
  email: string | null;
  portal_username: string | null;
  portal_enabled: boolean | null;
  status: ClientPortalAccess['status'];
  last_login_at: string | null;
  invited_at: string | null;
  code_created_at: string | null;
  code_rotated_at: string | null;
  modules_enabled: string[];
  two_factor_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export function mapClientPortalAccess(row: PortalAccessRow): ClientPortalAccess {
  const status =
    row.status === 'eingeladen' ? 'nicht_eingerichtet' : row.status;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    contactId: row.contact_id,
    email: row.email,
    portalUsername: row.portal_username,
    portalEnabled: row.portal_enabled ?? false,
    status,
    lastLoginAt: row.last_login_at,
    invitedAt: row.invited_at,
    codeCreatedAt: row.code_created_at,
    codeRotatedAt: row.code_rotated_at,
    modulesEnabled: row.modules_enabled ?? [],
    twoFactorEnabled: row.two_factor_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type TaskRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  category: ClientTask['category'];
  title: string;
  description: string | null;
  frequency: ClientTask['frequency'];
  duration_minutes: number | null;
  is_active: boolean;
  catalog_task_id: string | null;
  assigned_employee_ids: string[];
  created_at: string;
  updated_at: string;
};

export function mapClientTask(row: TaskRow): ClientTask {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    category: row.category,
    title: row.title,
    description: row.description,
    frequency: row.frequency,
    durationMinutes: row.duration_minutes,
    isActive: row.is_active,
    catalogTaskId: row.catalog_task_id,
    assignedEmployeeIds: row.assigned_employee_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type TimelineRow = {
  id: string;
  client_id: string;
  event_type: ClientTimelineEvent['eventType'];
  icon: string;
  title: string;
  subtitle: string | null;
  status: ClientTimelineEvent['status'];
  actor_name: string | null;
  is_internal: boolean;
  metadata: Record<string, string> | null;
  created_at: string;
};

export function mapClientTimelineEvent(row: TimelineRow): ClientTimelineEvent {
  return {
    id: row.id,
    clientId: row.client_id,
    eventType: row.event_type,
    icon: row.icon,
    title: row.title,
    subtitle: row.subtitle,
    timestamp: row.created_at,
    status: row.status,
    actorName: row.actor_name,
    isInternal: row.is_internal,
    metadata: row.metadata,
  };
}

export function mapClientFullDetail(input: {
  client: ClientExtendedRow;
  contacts: unknown[];
  consents: unknown[];
  audit: unknown[];
  history: unknown[];
  addresses: unknown[];
  careLevels: unknown[];
  budgets: unknown[];
  billingProfiles: unknown[];
  contracts: unknown[];
  documents: unknown[];
  intakeDocuments?: unknown[];
  notes: unknown[];
  risks: unknown[];
  portalAccess: unknown[];
  tasks: unknown[];
  timeline: unknown[];
}): ClientFullDetail {
  const contacts = input.contacts as ClientContactRow[];
  const consents = input.consents as ClientConsentRow[];
  const audit = input.audit as ClientAuditRow[];
  const history = input.history as ClientHistoryRow[];
  const addresses = input.addresses as AddressRow[];
  const careLevels = input.careLevels as CareLevelRow[];
  const budgets = input.budgets as BudgetRow[];
  const billingProfiles = input.billingProfiles as BillingProfileRow[];
  const contracts = input.contracts as ContractRow[];
  const documents = input.documents as DocumentRow[];
  const intakeDocuments = (input.intakeDocuments ?? []) as Parameters<typeof mergeClientRecordDocuments>[1];
  const notes = input.notes as NoteRow[];
  const risks = input.risks as RiskRow[];
  const portalAccess = input.portalAccess as PortalAccessRow[];
  const tasks = input.tasks as TaskRow[];
  const timeline = input.timeline as TimelineRow[];

  const detailRow: ClientDetailRow = {
    ...(input.client as unknown as ClientDetailRow),
    status:
      ((input.client as { status?: string }).status ??
        input.client.lifecycle_status ??
        'aktiv') as WorkflowStatus,
    client_contacts: contacts,
    client_consents: consents,
    client_audit_entries: audit,
    client_history_entries: history,
  };
  const base: ClientDetail = mapClientDetail(detailRow);
  const core = mapClientCore(input.client);
  const mergedDocuments = mergeClientRecordDocuments(
    documents.map(mapClientDocument),
    intakeDocuments,
  );

  return {
    ...base,
    admissionDate: typeof input.client.admission_date === 'string' ? input.client.admission_date : null,
    core,
    lifecycleStatus: core.lifecycleStatus,
    addresses: addresses.map(mapClientAddress),
    contacts: contacts.map(mapClientContactExtended),
    careLevels: careLevels.map(mapClientCareLevel),
    budgets: budgets.map(mapClientBudget),
    billingProfile: billingProfiles[0] ? mapClientBillingProfile(billingProfiles[0]) : null,
    contracts: contracts.map(mapClientContract),
    preferences: null,
    risks: risks.map(mapClientRisk),
    emergencyPlan: null,
    consents: consents.map((row) => mapClientConsentExtended(row as ClientConsentRow & { consent_type?: ConsentType | null })),
    portalAccess: portalAccess.map(mapClientPortalAccess),
    documents: mergedDocuments,
    tasks: tasks.map(mapClientTask),
    timeline: timeline.map(mapClientTimelineEvent),
    internalNotes: notes.filter((n) => n.is_internal).map(mapClientInternalNote),
    contextCounts: {
      ...base.contextCounts,
      documents: mergedDocuments.length,
    },
  };
}
