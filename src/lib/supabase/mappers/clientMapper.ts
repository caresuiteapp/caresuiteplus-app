import type { ClientDetail } from '@/types/detail';
import type { DataVisibilityScope, SensitivityLevel } from '@/types/portal/visibility';
import type { ClientListItem } from '@/types/modules/office';
import {
  CLIENT_STATUS_HINTS,
  getAllowedStatusActions,
} from '@/lib/services/workflow/clientStatus';
import { remoteStatusToWorkflow } from '@/lib/services/clients/clientStatusBridge';
import { resolveClientPhone, resolveClientStreetLine } from '@/lib/clients/clientAddressResolver';
import {
  resolveClientContactDisplayName,
  resolveClientContactIsEmergency,
} from '@/lib/clients/clientContactPayload';
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
    zip: row.postal_code ?? null,
    notes: row.internal_notes ?? row.visible_notes_for_employee ?? null,
    costCarrier: row.cost_bearer ?? null,
    insuranceNumber: row.insurance_number ?? null,
    admissionDate: row.admission_date ?? null,
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
    dateOfBirth: row.date_of_birth,
    primaryContactPhone: resolveClientPhone(row) ?? row.mobile ?? row.phone ?? null,
    street: resolveClientStreetLine(row) ?? row.street,
    city: row.city,
    zip: normalized.zip,
    costCarrier: normalized.costCarrier,
    insuranceNumber: normalized.insuranceNumber,
    sensitivity: 'internal' as SensitivityLevel,
    updatedAt: row.updated_at,
  };
}

function mapContact(row: ClientContactRow) {
  return {
    id: row.id,
    name: resolveClientContactDisplayName(row),
    relationship: row.relationship,
    phone: row.phone,
    email: row.email,
    isEmergency: resolveClientContactIsEmergency(row),
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
    dateOfBirth: row.date_of_birth,
    admissionDate: normalized.admissionDate,
    insuranceNumber: normalized.insuranceNumber,
    primaryContactPhone: resolveClientPhone(row) ?? row.phone ?? row.mobile ?? null,
    street: resolveClientStreetLine(row) ?? row.street,
    phone: resolveClientPhone(row) ?? row.phone,
    email: row.email,
    notes: normalized.notes,
    visibility: 'internal' as DataVisibilityScope,
    ownedByProfileId: undefined,
    sharedWithProfileIds: [],
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
