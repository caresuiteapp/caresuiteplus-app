import type { ClientDetail } from '@/types/detail';
import type { DataVisibilityScope, SensitivityLevel } from '@/types/portal/visibility';
import type { ClientListItem } from '@/types/modules/office';
import {
  CLIENT_STATUS_HINTS,
  getAllowedStatusActions,
} from '@/lib/services/workflow/clientStatus';
import { remoteStatusToWorkflow } from '@/lib/services/clients/clientStatusBridge';
import { resolveClientPhone, resolveClientStreetLine } from '@/lib/clients/clientAddressResolver';
import type {
  ClientAuditRow,
  ClientConsentRow,
  ClientContactRow,
  ClientDetailRow,
  ClientHistoryRow,
  ClientRow,
} from '../rowTypes';

function normalizeClientRow(row: ClientRow) {
  return {
    zip: row.postal_code ?? row.zip ?? null,
    notes: row.internal_notes ?? row.notes ?? null,
    costCarrier: row.cost_bearer ?? null,
    insuranceNumber: row.insurance_number ?? null,
    archivedAt: row.archived_at ?? null,
    createdBy: row.created_by ?? null,
    status: remoteStatusToWorkflow(row.status),
  };
}

export function mapClientListItem(row: ClientRow): ClientListItem {
  const normalized = normalizeClientRow(row);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    firstName: row.first_name,
    lastName: row.last_name,
    status: normalized.status,
    careLevel: row.care_level,
    city: row.city,
    zip: normalized.zip,
    costCarrier: normalized.costCarrier,
    insuranceNumber: normalized.insuranceNumber,
    archivedAt: normalized.archivedAt,
    createdBy: normalized.createdBy,
    sensitivity: (row.sensitivity ?? 'standard') as SensitivityLevel,
    updatedAt: row.updated_at,
  };
}

function mapContact(row: ClientContactRow) {
  return {
    id: row.id,
    name: row.name,
    relationship: row.relationship,
    phone: row.phone,
    email: row.email,
    isEmergency: row.is_emergency,
  };
}

function mapConsent(row: ClientConsentRow) {
  return {
    id: row.id,
    title: row.title,
    scope: row.scope as DataVisibilityScope,
    granted: row.granted,
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
  };
}

function mapAudit(row: ClientAuditRow) {
  return {
    id: row.id,
    action: row.action,
    actorName: row.actor_name ?? '',
    timestamp: row.created_at,
    details: row.details ?? undefined,
  };
}

function mapHistory(row: ClientHistoryRow) {
  return {
    id: row.id,
    icon: row.icon,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    timestamp: row.created_at,
    status: remoteStatusToWorkflow(row.status),
    actorName: row.actor_name ?? undefined,
  };
}

export function mapClientDetail(row: ClientDetailRow): ClientDetail {
  const base = mapClientListItem(row);
  const normalized = normalizeClientRow(row);
  const history = (row.client_history_entries ?? []).map(mapHistory);
  const audit = (row.client_audit_entries ?? []).map(mapAudit);

  return {
    ...base,
    createdAt: row.created_at,
    admissionDate: row.admission_date ?? null,
    dateOfBirth: row.date_of_birth,
    primaryContactPhone: row.primary_contact_phone,
    street: resolveClientStreetLine(row) ?? row.street,
    phone: resolveClientPhone(row) ?? row.phone,
    email: row.email,
    notes: normalized.notes,
    visibility: (row.visibility ?? 'internal') as DataVisibilityScope,
    ownedByProfileId: row.owned_by_profile_id ?? undefined,
    sharedWithProfileIds: row.shared_with_profile_ids ?? [],
    contacts: (row.client_contacts ?? []).map((c) => ({
      ...mapContact(c),
      relationship: c.relationship ?? '',
    })),
    consents: (row.client_consents ?? []).map(mapConsent),
    auditEntries: audit,
    history,
    contextCounts: {
      assignments: 0,
      documents: 0,
      invoices: 0,
      appointments: 0,
    },
    nextActionHint: CLIENT_STATUS_HINTS[base.status],
    allowedStatusActions: getAllowedStatusActions(base.status),
  };
}
