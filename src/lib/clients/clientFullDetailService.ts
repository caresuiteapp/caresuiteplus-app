import type { ServiceResult } from '@/types';
import type { ClientFullDetail } from '@/types/modules/client';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { getDemoClientDetail } from '@/data/demo/clientDetails';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';
import { maskSensitiveCore } from './portalFilter';

async function fetchDemoClientFullDetail(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientFullDetail>> {
  const denied = assertDemoTenant(tenantId);
  if (denied) return denied;

  const full = getDemoClientFullDetail(clientId);
  if (full) {
    return { ok: true, data: full };
  }

  const basic = getDemoClientDetail(clientId);
  if (!basic) {
    return { ok: false, error: SERVICE_ERRORS.clientNotFound };
  }

  const minimal: ClientFullDetail = {
    ...basic,
    lifecycleStatus: 'aktiv',
    core: {
      id: basic.id,
      tenantId: basic.tenantId,
      firstName: basic.firstName,
      lastName: basic.lastName,
      salutation: null,
      gender: null,
      dateOfBirth: basic.dateOfBirth,
      lifecycleStatus: 'aktiv',
      insuranceNumber: null,
      keySafeCode: null,
      diagnoses: [],
      primaryContactPhone: basic.primaryContactPhone,
      city: basic.city ?? null,
      zip: basic.zip ?? null,
      sensitivity: basic.sensitivity,
      visibility: basic.visibility,
      ownedByProfileId: basic.ownedByProfileId,
      sharedWithProfileIds: basic.sharedWithProfileIds,
      createdAt: basic.createdAt,
      updatedAt: basic.updatedAt,
    },
    addresses: basic.street
      ? [{
          id: `addr-${basic.id}`, tenantId: basic.tenantId, clientId: basic.id,
          addressType: 'hauptwohnsitz', street: basic.street, zip: basic.zip ?? '', city: basic.city ?? '',
          country: 'DE', isPrimary: true, accessNotes: null, floor: null, apartmentNumber: null, doorCode: null,
          createdAt: basic.createdAt, updatedAt: basic.updatedAt,
        }]
      : [],
    contacts: basic.contacts.map((c) => ({
      id: c.id, tenantId: basic.tenantId, clientId: basic.id,
      firstName: c.name.split(' ')[0] ?? c.name, lastName: c.name.split(' ').slice(1).join(' ') || '',
      contactType: c.isEmergency ? ('emergency_contact' as const) : ('other' as const),
      relationship: 'angehoerige' as const, relationshipLabel: c.relationship,
      phone: c.phone, email: c.email, isEmergency: c.isEmergency,
      isPortalUser: false,
      portalPermissions: { canViewAppointments: false, canViewDocuments: false, canViewCarePlan: false, canSendMessages: false, canViewBilling: false },
      notes: null, createdAt: basic.createdAt, updatedAt: basic.updatedAt,
    })),
    careLevels: basic.careLevel
      ? [{
          id: `cl-${basic.id}`, tenantId: basic.tenantId, clientId: basic.id,
          grade: 'pg2' as const, validFrom: basic.createdAt.slice(0, 10), validUntil: null,
          careFundName: 'Unbekannt', careFundMemberId: null, mdAssessmentDate: null, notes: null,
          createdAt: basic.createdAt, updatedAt: basic.updatedAt,
        }]
      : [],
    budgets: [],
    billingProfile: null,
    contracts: [],
    preferences: null,
    schedulingWishes: null,
    risks: [],
    emergencyPlan: null,
    consents: basic.consents.map((c) => ({
      id: c.id, tenantId: basic.tenantId, clientId: basic.id,
      consentType: 'datenschutz' as const, title: c.title, scope: c.scope,
      granted: c.granted, grantedAt: c.grantedAt, expiresAt: c.expiresAt,
      grantedByProfileId: null, documentId: null, notes: null,
      createdAt: basic.createdAt, updatedAt: basic.updatedAt,
    })),
    portalAccess: [],
    documents: [],
    tasks: [],
    timeline: basic.history.map((h) => ({
      id: h.id, clientId: basic.id, eventType: 'sonstige' as const,
      icon: h.icon, title: h.title, subtitle: h.subtitle ?? null,
      timestamp: h.timestamp, status: h.status, actorName: h.actorName ?? null,
      isInternal: false, metadata: null,
    })),
    internalNotes: basic.notes
      ? [{
          id: `note-${basic.id}`, clientId: basic.id, tenantId: basic.tenantId,
          content: basic.notes, isInternal: true as const, createdBy: 'System',
          createdAt: basic.createdAt, updatedAt: basic.updatedAt, category: 'allgemein' as const,
        }]
      : [],
  };

  return { ok: true, data: minimal };
}

export async function fetchClientFullDetail(
  tenantId: string,
  clientId: string,
  options?: { canViewSensitive?: boolean },
): Promise<ServiceResult<ClientFullDetail>> {
  return runService(async () => {
    const result = isDemoClientBackend()
      ? await fetchDemoClientFullDetail(tenantId, clientId)
      : await getClientExtendedRepository().fetchFullDetail(tenantId, clientId);

    if (!result.ok) return result;

    return {
      ok: true,
      data: maskSensitiveCore(result.data, options?.canViewSensitive ?? true),
    };
  }, { delayMs: 300 });
}

export function saveClientFullDetail(detail: ClientFullDetail): void {
  if (isDemoClientBackend()) {
    upsertDemoClientFullDetail(detail);
  }
}
