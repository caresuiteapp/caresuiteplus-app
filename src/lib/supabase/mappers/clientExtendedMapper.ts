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
import { mergeClientAddresses } from '@/lib/clients/clientAddressResolver';
import { mapClientDetail } from './clientMapper';
import { mergeClientRecordDocuments } from '@/lib/clients/clientDocumentMerge';
import {
  resolveClientContactDisplayName,
  resolveClientContactIsEmergency,
  resolveClientContactType,
} from '@/lib/clients/clientContactPayload';
import type {
  ClientAuditRow,
  ClientConsentRow,
  ClientContactRow,
  ClientDetailRow,
  ClientExtendedRow,
  ClientHistoryRow,
  ClientAddressRow,
  ClientDocumentRow,
  ClientTaskRow,
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

function splitContactName(row: ClientContactRow) {
  const displayName = resolveClientContactDisplayName(row);
  if (row.first_name || row.last_name) {
    return {
      firstName: row.first_name?.trim() || displayName.split(' ')[0] || displayName,
      lastName: row.last_name?.trim() || displayName.split(' ').slice(1).join(' ') || '',
    };
  }
  const parts = displayName.split(/\s+/);
  return {
    firstName: parts[0] ?? displayName,
    lastName: parts.slice(1).join(' ') || '',
  };
}

export function mapClientContactExtended(row: ClientContactRow): ClientContactRecord {
  const { firstName, lastName } = splitContactName(row);
  return {
    id: row.id,
    tenantId: row.tenant_id ?? '',
    clientId: row.client_id ?? '',
    firstName,
    lastName,
    contactType: resolveClientContactType(row),
    relationship: parseRelationship(row.relationship ?? ''),
    relationshipLabel: row.relationship ?? '',
    phone: row.phone,
    email: row.email,
    isEmergency: resolveClientContactIsEmergency(row),
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
    primaryContactPhone: row.primary_contact_phone ?? row.phone ?? row.mobile ?? null,
    city: row.city,
    zip: row.postal_code ?? row.zip ?? null,
    sensitivity: 'internal' as SensitivityLevel,
    visibility: (row.visibility ?? 'team') as DataVisibilityScope,
    ownedByProfileId: row.owned_by_profile_id ?? undefined,
    sharedWithProfileIds: row.shared_with_profile_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type AddressRow = ClientAddressRow;

export function mapClientAddress(row: AddressRow): ClientAddress {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    addressType: row.address_type as ClientAddress['addressType'],
    street: row.street,
    zip: row.zip,
    city: row.city,
    country: row.country,
    isPrimary: row.is_primary,
    accessNotes: row.access_notes,
    floor: row.floor,
    apartmentNumber: row.apartment_number,
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

type DocumentRow = ClientDocumentRow;

export function mapClientDocument(row: DocumentRow): ClientDocumentRecord {
  const source = row.source ?? null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    title: row.title,
    fileName: row.file_name,
    mimeType: row.mime_type,
    category: row.category as ClientDocumentRecord['category'],
    storagePath: row.storage_path,
    status: row.status as ClientDocumentRecord['status'],
    sensitivity: row.sensitivity as ClientDocumentRecord['sensitivity'],
    uploadedBy: row.uploaded_by,
    validUntil: row.valid_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documentSource: source === 'intake' ? 'intake' : source === 'upload' ? 'upload' : null,
    intakeDocumentId: row.intake_document_id ?? null,
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

export type PortalAccessRow = {
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

type TaskRow = ClientTaskRow;

export function mapClientTask(row: TaskRow): ClientTask {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    category: row.category as ClientTask['category'],
    title: row.title,
    description: row.description,
    frequency: row.frequency as ClientTask['frequency'],
    durationMinutes: row.duration_minutes,
    isActive: row.is_active,
    catalogTaskId: row.catalog_task_id,
    assignedEmployeeIds: row.assigned_employee_ids ?? [],
    moduleKey: row.module_key ?? 'assist',
    leistungsbereich: row.leistungsbereich ?? null,
    subcategory: row.subcategory ?? null,
    packageId: row.package_id ?? null,
    leistungsart: row.leistungsart ?? null,
    isMandatory: row.is_mandatory ?? false,
    proofRequired: row.proof_required ?? false,
    documentationRequired: row.documentation_required ?? true,
    billingRelevant: row.billing_relevant ?? true,
    visibleToClient: row.visible_to_client ?? true,
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
    ...(input.client as ClientDetailRow),
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
  const mappedAddresses = addresses.map(mapClientAddress);
  const resolvedAddresses = mergeClientAddresses(mappedAddresses, {
    id: input.client.id,
    tenant_id: input.client.tenant_id,
    street: typeof input.client.street === 'string' ? input.client.street : null,
    house_number: typeof input.client.house_number === 'string' ? input.client.house_number : null,
    postal_code: input.client.postal_code ?? input.client.zip ?? null,
    zip: input.client.zip ?? null,
    city: input.client.city,
    created_at: input.client.created_at,
    updated_at: input.client.updated_at,
  });

  return {
    ...base,
    core,
    lifecycleStatus: core.lifecycleStatus,
    addresses: resolvedAddresses,
    contacts: contacts.map(mapClientContactExtended),
    careLevels: careLevels.map(mapClientCareLevel),
    budgets: budgets.map(mapClientBudget),
    billingProfile: billingProfiles[0] ? mapClientBillingProfile(billingProfiles[0]) : null,
    contracts: contracts.map(mapClientContract),
    preferences: null,
    schedulingWishes: null,
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
