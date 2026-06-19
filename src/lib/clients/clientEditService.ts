import type { RoleKey, ServiceResult } from '@/types';
import type { ClientDetail } from '@/types/detail';
import type { ClientFullDetail } from '@/types/modules/client';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import type { ClientEditFormData } from '@/types/forms/clientEditForm';
import { fetchClientDetail } from '@/lib/office/clientDetailService';
import { fetchClientFullDetail } from '@/lib/clients/clientFullDetailService';
import { resolveCareContextsForClient } from '@/lib/clients/clientRecordService';
import {
  mapClientEditRawFields,
  mapClientToEditForm,
  type ClientEditRawFields,
} from '@/lib/clients/clientEditFormMappers';
import { persistClientEditData } from '@/lib/clients/clientEditPersistence';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { fetchClientModuleAssignments, saveClientModuleAssignments } from '@/lib/portal/clientModuleAssignmentService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isDemoClientBackend } from '@/lib/clients/clientBackend';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { updateDemoClientDetail } from '@/data/demo/clientDetails';
import { buildStreetLine } from '@/lib/clients/clientEditFormMappers';

export type ClientEditLoadResult = {
  detail: ClientDetail;
  fullClient: ClientFullDetail;
  careContexts: ClientCareContext[];
  rawFields: ClientEditRawFields;
  form: ClientEditFormData;
};

async function fetchRawClientFields(
  tenantId: string,
  clientId: string,
): Promise<ClientEditRawFields> {
  const supabase = getSupabaseClient();
  if (!supabase) return mapClientEditRawFields(null);

  const { data } = await supabase
    .from('clients')
    .select(
      'mobile, house_number, access_notes, floor, apartment_number, doorbell_name, diagnoses_notes, mobility_notes, visible_notes_for_employee, emergency_notes, key_management_notes',
    )
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .single();

  return mapClientEditRawFields(data as Record<string, unknown> | null);
}

export async function fetchClientEditData(
  clientId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ClientEditLoadResult>> {
  const denied = enforcePermission<ClientEditLoadResult>(actorRoleKey, 'office.clients.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const [detailResult, fullResult, careContexts, rawFields, moduleAssignmentsResult] = await Promise.all([
    fetchClientDetail(clientId, tenantId, actorRoleKey),
    fetchClientFullDetail(tenantId, clientId, { canViewSensitive: true }),
    resolveCareContextsForClient(tenantId, clientId),
    isDemoClientBackend() ? Promise.resolve(mapClientEditRawFields(null)) : fetchRawClientFields(tenantId, clientId),
    fetchClientModuleAssignments(tenantId, clientId),
  ]);

  if (!detailResult.ok) return detailResult;
  if (!fullResult.ok) return fullResult;

  const form = mapClientToEditForm(detailResult.data, fullResult.data, careContexts, rawFields);
  form.portalModules = moduleAssignmentsResult.ok
    ? moduleAssignmentsResult.data.map((assignment) => assignment.moduleKey)
    : [];

  return {
    ok: true,
    data: {
      detail: detailResult.data,
      fullClient: fullResult.data,
      careContexts,
      rawFields,
      form,
    },
  };
}

function applyDemoEdit(clientId: string, form: ClientEditFormData): ServiceResult<void> {
  const full = getDemoClientFullDetail(clientId);
  if (!full) return { ok: false, error: 'Klient:in nicht gefunden.' };

  const streetLine = buildStreetLine(form.street, form.houseNumber);
  const now = new Date().toISOString();
  const emergencyName = form.emergencyContactName.trim();
  const relativeName = form.relativeContactName.trim();

  const updated: ClientFullDetail = {
    ...full,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    dateOfBirth: form.dateOfBirth || null,
    street: streetLine,
    zip: form.zip.trim(),
    city: form.city.trim(),
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    notes: form.notes.trim() || null,
    careLevel: form.careLevel.trim() || null,
    costCarrier: form.costCarrier.trim() || null,
    insuranceNumber: form.insuranceNumber.trim() || null,
    primaryContactPhone: form.phone.trim() || form.mobile.trim() || null,
    updatedAt: now,
    core: {
      ...full.core,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      salutation: form.salutation || null,
      gender: (form.gender as ClientFullDetail['core']['gender']) || null,
      dateOfBirth: form.dateOfBirth || null,
      insuranceNumber: form.insuranceNumber.trim() || null,
      diagnoses: form.diagnosesNotes.trim() ? form.diagnosesNotes.split(',').map((d) => d.trim()) : [],
      primaryContactPhone: form.phone.trim() || form.mobile.trim() || null,
      city: form.city.trim(),
      zip: form.zip.trim(),
      updatedAt: now,
    },
    addresses: full.addresses.length > 0
      ? full.addresses.map((a, index) => (
          index === 0 || a.isPrimary
            ? {
                ...a,
                street: streetLine,
                zip: form.zip.trim(),
                city: form.city.trim(),
                accessNotes: form.accessNotes.trim() || null,
                floor: form.floor.trim() || null,
                apartmentNumber: form.apartmentNumber.trim() || null,
                doorCode: form.accessCode.trim() || null,
                updatedAt: now,
              }
            : a
        ))
      : streetLine
        ? [{
            id: `addr-${clientId}`,
            tenantId: full.tenantId,
            clientId,
            addressType: 'hauptwohnsitz',
            street: streetLine,
            zip: form.zip.trim(),
            city: form.city.trim(),
            country: 'DE',
            isPrimary: true,
            accessNotes: form.accessNotes.trim() || null,
            floor: form.floor.trim() || null,
            apartmentNumber: form.apartmentNumber.trim() || null,
            doorCode: form.accessCode.trim() || null,
            createdAt: now,
            updatedAt: now,
          }]
        : [],
    contacts: [
      ...full.contacts.filter(
        (c) =>
          c.id !== form.emergencyContactId
          && c.id !== form.relativeContactId
          && !c.isEmergency
          && c.relationship !== 'angehoerige',
      ),
      ...(emergencyName || form.emergencyContactPhone.trim()
        ? [{
            id: form.emergencyContactId ?? `contact-${clientId}-em`,
            tenantId: full.tenantId,
            clientId,
            firstName: emergencyName.split(' ')[0] ?? emergencyName,
            lastName: emergencyName.split(' ').slice(1).join(' ') || '',
            relationship: 'angehoerige' as const,
            relationshipLabel: 'Notfallkontakt',
            phone: form.emergencyContactPhone.trim() || null,
            email: null,
            isEmergency: true,
            isPortalUser: false,
            portalPermissions: full.contacts[0]?.portalPermissions ?? {
              canViewAppointments: false,
              canViewDocuments: false,
              canViewCarePlan: false,
              canSendMessages: false,
              canViewBilling: false,
            },
            notes: null,
            createdAt: now,
            updatedAt: now,
          }]
        : []),
      ...(relativeName || form.relativeContactPhone.trim()
        ? [{
            id: form.relativeContactId ?? `contact-${clientId}-rel`,
            tenantId: full.tenantId,
            clientId,
            firstName: relativeName.split(' ')[0] ?? relativeName,
            lastName: relativeName.split(' ').slice(1).join(' ') || '',
            relationship: 'angehoerige' as const,
            relationshipLabel: 'Angehörige:r',
            phone: form.relativeContactPhone.trim() || null,
            email: null,
            isEmergency: false,
            isPortalUser: false,
            portalPermissions: full.contacts[0]?.portalPermissions ?? {
              canViewAppointments: false,
              canViewDocuments: false,
              canViewCarePlan: false,
              canSendMessages: false,
              canViewBilling: false,
            },
            notes: null,
            createdAt: now,
            updatedAt: now,
          }]
        : []),
    ],
    billingProfile: full.billingProfile && form.billingType && form.serviceType
      ? {
          ...full.billingProfile,
          billingType: form.billingType,
          serviceType: form.serviceType,
          costBearerName: form.costCarrier.trim() || full.billingProfile.costBearerName,
          updatedAt: now,
        }
      : full.billingProfile,
    careLevels: form.careLevel.trim()
      ? [{
          ...(full.careLevels[0] ?? {
            id: `cl-${clientId}`,
            tenantId: full.tenantId,
            clientId,
            validFrom: now.slice(0, 10),
            validUntil: null,
            careFundMemberId: null,
            mdAssessmentDate: null,
            notes: null,
            createdAt: now,
          }),
          grade: form.careLevel.trim() as ClientFullDetail['careLevels'][number]['grade'],
          careFundName: form.costCarrier.trim() || full.careLevels[0]?.careFundName || 'Unbekannt',
          updatedAt: now,
        }]
      : full.careLevels,
    preferences: full.preferences
      ? { ...full.preferences, mobilityNotes: form.mobilityNotes.trim() || null, updatedAt: now }
      : form.mobilityNotes.trim()
        ? {
            id: `pref-${clientId}`,
            tenantId: full.tenantId,
            clientId,
            preferredShifts: [],
            preferredEmployeeIds: [],
            excludedEmployeeIds: [],
            language: null,
            mobilityNotes: form.mobilityNotes.trim(),
            householdNotes: null,
            petNotes: null,
            accessInstructions: form.communicationNotes.trim() || null,
            createdAt: now,
            updatedAt: now,
          }
        : null,
  };

  upsertDemoClientFullDetail(updated);
  updateDemoClientDetail(updated);
  return { ok: true, data: undefined };
}

export async function saveClientEdit(
  clientId: string,
  tenantId: string,
  form: ClientEditFormData,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<ClientDetail>> {
  const denied = enforcePermission<ClientDetail>(actorRoleKey, 'office.clients.edit');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (isDemoClientBackend()) {
    const demoResult = applyDemoEdit(clientId, form);
    if (!demoResult.ok) return demoResult;
    return fetchClientDetail(clientId, tenantId, actorRoleKey);
  }

  const persistResult = await persistClientEditData(tenantId, clientId, form, actorProfileId);
  if (!persistResult.ok) return persistResult;

  const moduleResult = await saveClientModuleAssignments(
    tenantId,
    clientId,
    form.portalModules,
    actorProfileId,
  );
  if (!moduleResult.ok) return moduleResult;

  return fetchClientDetail(clientId, tenantId, actorRoleKey);
}
