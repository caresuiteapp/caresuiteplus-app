import type { ServiceResult } from '@/types';
import type { ClientDetail } from '@/types/detail';
import type { ClientListItem } from '@/types/modules/office';
import type { ClientFormData } from '@/types/forms/clientForm';
import {
  addDemoClient,
  getDemoClientDetail,
  getDemoClientListItems,
  updateDemoClientDetail,
} from '@/data/demo/clientDetails';
import { upsertDemoClientFullDetail } from '@/data/demo/clients';
import type { ClientFullDetail } from '@/types/modules/client';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { SERVICE_ERRORS } from '../errors';
import { assertTenant } from '../serviceRunner';
import {
  canTransitionStatus,
  CLIENT_STATUS_HINTS,
  getAllowedStatusActions,
} from '../workflow/clientStatus';
import type { ClientListOptions, ClientRepository, ClientUpdateInput } from './types';

function applyStatusMeta(detail: ClientDetail): ClientDetail {
  return {
    ...detail,
    nextActionHint: CLIENT_STATUS_HINTS[detail.status],
    allowedStatusActions: getAllowedStatusActions(detail.status),
  };
}

function appendHistory(
  detail: ClientDetail,
  entry: ClientDetail['history'][number],
): ClientDetail {
  return {
    ...detail,
    history: [entry, ...detail.history],
    updatedAt: new Date().toISOString(),
  };
}

export const demoClientRepository: ClientRepository = {
  async list(tenantId, options) {
    const denied = assertTenant(tenantId, DEMO_TENANT_ID);
    if (denied) return denied;

    if (options?.simulateError) {
      return { ok: false, error: SERVICE_ERRORS.loadListFailed };
    }
    if (options?.simulateEmpty) {
      return { ok: true, data: [] };
    }
    return { ok: true, data: getDemoClientListItems() };
  },

  async getById(tenantId, clientId) {
    const denied = assertTenant(tenantId, DEMO_TENANT_ID);
    if (denied) return denied;

    const detail = getDemoClientDetail(clientId);
    if (!detail) {
      return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    }
    return { ok: true, data: applyStatusMeta(detail) };
  },

  async create(tenantId, form) {
    const denied = assertTenant(tenantId, DEMO_TENANT_ID);
    if (denied) return denied;

    const id = `client-${Date.now()}`;
    const now = new Date().toISOString();

    const listItem: ClientListItem = {
      id,
      tenantId,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      status: form.status,
      careLevel: form.careLevel.trim() || null,
      city: form.city.trim(),
      zip: form.zip.trim(),
      sensitivity: form.sensitivity,
      updatedAt: now,
    };

    const detail: ClientDetail = applyStatusMeta({
      ...listItem,
      createdAt: now,
      dateOfBirth: form.dateOfBirth || null,
      primaryContactPhone: form.phone.trim() || null,
      street: form.street.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
      visibility: 'team',
      ownedByProfileId: 'profile-admin-001',
      sharedWithProfileIds: [],
      contacts: [],
      consents: [
        {
          id: `consent-${id}-1`,
          title: 'Portal-Zugang Klient:in',
          scope: 'own',
          granted: false,
          grantedAt: null,
          expiresAt: null,
        },
      ],
      auditEntries: [
        {
          id: `audit-${id}-1`,
          action: 'Klient:in angelegt',
          actorName: 'Sabine Muster',
          timestamp: now,
          details: 'Anlage über Assistent',
        },
      ],
      history: [
        {
          id: `hist-${id}-1`,
          icon: '✨',
          title: 'Klient:in angelegt',
          timestamp: now,
          status: form.status,
          actorName: 'Sabine Muster',
        },
      ],
      contextCounts: { assignments: 0, documents: 0, invoices: 0, appointments: 0 },
      nextActionHint: CLIENT_STATUS_HINTS.entwurf,
      allowedStatusActions: getAllowedStatusActions('entwurf'),
    });

    addDemoClient(listItem, detail);

    const hourlyRateCents = Math.round(Number(form.hourlyRate || '0') * 100);
    const fullDetail: ClientFullDetail = {
      ...detail,
      lifecycleStatus: 'interessent',
      core: {
        id,
        tenantId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        salutation: null,
        gender: null,
        dateOfBirth: form.dateOfBirth || null,
        lifecycleStatus: 'interessent',
        insuranceNumber: null,
        keySafeCode: null,
        diagnoses: [],
        primaryContactPhone: form.phone.trim() || null,
        city: form.city.trim(),
        zip: form.zip.trim(),
        sensitivity: form.sensitivity,
        visibility: 'team',
        ownedByProfileId: 'profile-admin-001',
        sharedWithProfileIds: [],
        createdAt: now,
        updatedAt: now,
      },
      addresses: [{
        id: `addr-${id}`, tenantId, clientId: id,
        addressType: 'hauptwohnsitz', street: form.street.trim(), zip: form.zip.trim(), city: form.city.trim(),
        country: 'DE', isPrimary: true, accessNotes: null, floor: null, doorCode: null,
        createdAt: now, updatedAt: now,
      }],
      contacts: form.emergencyContactName.trim() ? [{
        id: `contact-${id}-1`, tenantId, clientId: id,
        firstName: form.emergencyContactName.split(' ')[0] ?? form.emergencyContactName,
        lastName: form.emergencyContactName.split(' ').slice(1).join(' ') || '',
        relationship: 'angehoerige', relationshipLabel: 'Notfallkontakt',
        phone: form.emergencyContactPhone.trim() || null, email: null,
        isEmergency: true, isPortalUser: false,
        portalPermissions: { canViewAppointments: false, canViewDocuments: false, canViewCarePlan: false, canSendMessages: false, canViewBilling: false },
        notes: null, createdAt: now, updatedAt: now,
      }] : [],
      careLevels: form.careLevel.trim() ? [{
        id: `cl-${id}`, tenantId, clientId: id,
        grade: 'pg2', validFrom: form.contractStart || now.slice(0, 10), validUntil: null,
        careFundName: form.careFundName.trim(), careFundMemberId: null, mdAssessmentDate: null, notes: null,
        createdAt: now, updatedAt: now,
      }] : [],
      budgets: [],
      billingProfile: form.billingType ? {
        id: `bill-${id}`, tenantId, clientId: id,
        billingType: form.billingType, hourlyRateCents, serviceType: form.serviceType || 'betreuung',
        invoiceRecipient: form.careFundName.trim() || null, paymentTermsDays: 30,
        costBearerName: form.careFundName.trim() || null, costBearerReference: null,
        notes: null, createdAt: now, updatedAt: now,
      } : null,
      contracts: form.contractStart ? [{
        id: `contract-${id}`, tenantId, clientId: id,
        contractNumber: `PV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        contractStart: form.contractStart, contractEnd: null,
        serviceType: form.serviceType || 'betreuung', hourlyRateCents, weeklyHours: null,
        status: 'entwurf', signedAt: form.consentVertrag ? now : null, documentId: null,
        notes: null, createdAt: now, updatedAt: now,
      }] : [],
      preferences: null,
      risks: [],
      emergencyPlan: form.emergencyContactName.trim() ? {
        id: `em-${id}`, tenantId, clientId: id,
        emergencyContactName: form.emergencyContactName.trim(),
        emergencyContactPhone: form.emergencyContactPhone.trim(),
        emergencyContactRelation: null, doctorName: null, doctorPhone: null,
        hospitalPreference: null, allergies: [], medications: [],
        specialInstructions: null, dnrStatus: false,
        createdAt: now, updatedAt: now,
      } : null,
      consents: [
        {
          id: `consent-${id}-ds`, tenantId, clientId: id,
          consentType: 'datenschutz', title: 'Datenschutzerklärung', scope: 'own',
          granted: form.consentDatenschutz, grantedAt: form.consentDatenschutz ? now : null,
          expiresAt: null, grantedByProfileId: 'profile-admin-001', documentId: null, notes: null,
          createdAt: now, updatedAt: now,
        },
        {
          id: `consent-${id}-pv`, tenantId, clientId: id,
          consentType: 'vertrag', title: 'Pflegevertrag', scope: 'team',
          granted: form.consentVertrag, grantedAt: form.consentVertrag ? now : null,
          expiresAt: null, grantedByProfileId: 'profile-admin-001', documentId: null, notes: null,
          createdAt: now, updatedAt: now,
        },
      ],
      portalAccess: [],
      documents: [],
      tasks: form.taskCategories.map((cat, i) => ({
        id: `task-${id}-${i}`, tenantId, clientId: id,
        category: cat, title: cat, description: null, frequency: 'woechentlich' as const,
        durationMinutes: null, isActive: true, catalogTaskId: null, assignedEmployeeIds: [],
        createdAt: now, updatedAt: now,
      })),
      timeline: [{
        id: `tl-${id}-1`, clientId: id, eventType: 'status' as const,
        icon: '✨', title: 'Klient:in angelegt', subtitle: 'Anlage über Assistent',
        timestamp: now, status: form.status, actorName: 'Sabine Muster',
        isInternal: false, metadata: null,
      }],
      internalNotes: form.notes.trim() ? [{
        id: `note-${id}`, clientId: id, tenantId, content: form.notes.trim(),
        isInternal: true as const, createdBy: 'Sabine Muster',
        createdAt: now, updatedAt: now, category: 'allgemein' as const,
      }] : [],
    };
    upsertDemoClientFullDetail(fullDetail);

    return { ok: true, data: { id, detail } };
  },

  async update(tenantId, clientId, input) {
    const denied = assertTenant(tenantId, DEMO_TENANT_ID);
    if (denied) return denied;

    const detail = getDemoClientDetail(clientId);
    if (!detail) {
      return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    }

    const now = new Date().toISOString();
    const updated = applyStatusMeta(
      appendHistory(
        {
          ...detail,
          ...input,
          firstName: input.firstName?.trim() ?? detail.firstName,
          lastName: input.lastName?.trim() ?? detail.lastName,
          street: input.street?.trim() ?? detail.street,
          zip: input.zip?.trim() ?? detail.zip,
          city: input.city?.trim() ?? detail.city,
          phone: input.phone?.trim() ?? detail.phone,
          email: input.email?.trim() ?? detail.email,
          notes: input.notes?.trim() ?? detail.notes,
          careLevel: input.careLevel?.trim() ?? detail.careLevel,
          updatedAt: now,
          auditEntries: [
            {
              id: `audit-${clientId}-${Date.now()}`,
              action: 'Stammdaten aktualisiert',
              actorName: 'Sabine Muster',
              timestamp: now,
              details: 'Änderung über Service-Schicht',
            },
            ...detail.auditEntries,
          ],
        },
        {
          id: `hist-${Date.now()}`,
          icon: '✏️',
          title: 'Stammdaten bearbeitet',
          timestamp: now,
          status: detail.status,
          actorName: 'Sabine Muster',
        },
      ),
    );

    updateDemoClientDetail(updated);
    return { ok: true, data: updated };
  },

  async changeStatus(tenantId, clientId, newStatus) {
    const denied = assertTenant(tenantId, DEMO_TENANT_ID);
    if (denied) return denied;

    const detail = getDemoClientDetail(clientId);
    if (!detail) {
      return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    }
    if (!canTransitionStatus(detail.status, newStatus)) {
      return { ok: false, error: SERVICE_ERRORS.statusNotAllowed };
    }

    const updated = applyStatusMeta(
      appendHistory(
        { ...detail, status: newStatus },
        {
          id: `hist-${Date.now()}`,
          icon: '🔄',
          title: 'Status geändert',
          subtitle: `Neuer Status: ${newStatus}`,
          timestamp: new Date().toISOString(),
          status: newStatus,
          actorName: 'Sabine Muster',
        },
      ),
    );

    updateDemoClientDetail(updated);
    return { ok: true, data: updated };
  },

  async archive(tenantId, clientId) {
    return demoClientRepository.changeStatus(tenantId, clientId, 'archiviert');
  },
};
