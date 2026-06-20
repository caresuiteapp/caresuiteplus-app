import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types/core/auth';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import {
  getRequiredFieldsForClientContext,
  getVisibleSectionsForClientContext,
  type IntakeSectionKey,
} from '@/lib/clients/clientIntakeFieldRules';
import type { ClientIntakeErrors, ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
import { runService } from '@/lib/services/serviceRunner';
import { enforcePermission } from '@/lib/permissions';
import { assertDemoTenant, isDemoClientBackend } from './clientBackend';
import {
  COST_BEARER_FIELD_ERRORS,
  getCostBearerFieldValues,
  hasGkvCostBearerSelected,
  isCostBearerTypeKey,
  resolvePrimaryCostBearerName,
  resolvePrimaryCostBearerReference,
} from './clientIntakeCostBearerConfig';
import { resolveIntakeBillingProfileType } from './clientIntakeBilling';
import { validateCostBearerEntry, persistIntakeCostCarriers } from '@/features/costCarriers/costCarrierService';
import { listApplicableIntakeTemplates } from '@/features/intakeDocuments/buildIntakeDocumentContext';
import { validateIntakeDocumentsStep } from '@/features/intakeDocuments/validateIntakeDocuments';
import { persistClientIntakeDocuments } from '@/features/intakeDocuments/intakeDocumentService';
import { createClientFromIntake, updateClientFromIntake } from './repositories/clientIntakeRepository.supabase';
import { mapIntakeModulesToPortal, saveClientModuleAssignments } from '@/lib/portal/clientModuleAssignmentService';
import { persistIntakeClientExtendedData, syncIntakeClientExtendedData } from './clientIntakePersistence';

export function getIntakeStepsForContexts(contexts: ClientCareContext[]): IntakeSectionKey[] {
  return getVisibleSectionsForClientContext(contexts);
}

export function validateIntakeStep(
  section: IntakeSectionKey,
  form: ClientIntakeFormData,
): ClientIntakeErrors {
  const errors: ClientIntakeErrors = {};

  if (section === 'leistungsart') {
    if (form.careContexts.length === 0) {
      errors.careContexts = 'Mindestens eine Leistungsart auswählen.';
    }
  }

  if (section === 'stammdaten') {
    if (!form.firstName.trim()) errors.firstName = 'Vorname ist erforderlich.';
    if (!form.lastName.trim()) errors.lastName = 'Nachname ist erforderlich.';
    if (!form.dateOfBirth.trim()) errors.dateOfBirth = 'Geburtsdatum ist erforderlich.';
    if (!form.serviceStart.trim()) errors.serviceStart = 'Leistungsbeginn ist erforderlich.';
  }

  if (section === 'adresse_kontakt') {
    if (!form.street.trim()) errors.street = 'Straße ist erforderlich.';
    if (!form.zip.trim()) errors.zip = 'PLZ ist erforderlich.';
    if (!form.city.trim()) errors.city = 'Ort ist erforderlich.';
    if (!form.phone.trim() && !form.mobile.trim() && !form.email.trim()) {
      errors.phone = 'Telefon, Mobil oder E-Mail erforderlich.';
    }
  }

  const required = getRequiredFieldsForClientContext(form.careContexts);

  if (section === 'kostentraeger') {
    if (required.includes('billingTypes') && form.billingTypes.length === 0) {
      errors.billingTypes = 'Abrechnungsart ist erforderlich.';
    }
    if (required.includes('careLevel') && !form.careLevel) {
      errors.careLevel = 'Pflegegrad ist erforderlich.';
    }

    for (const type of form.costBearerTypes) {
      if (!isCostBearerTypeKey(type)) continue;
      const values = getCostBearerFieldValues(form, type);
      const entryError = validateCostBearerEntry(type, values);
      if (entryError) {
        errors[COST_BEARER_FIELD_ERRORS[type]] = entryError;
      }
    }

    if (required.includes('careFund') && form.costBearerTypes.includes('pflegekasse')) {
      const name = getCostBearerFieldValues(form, 'pflegekasse').name.trim();
      if (!name) errors.careFundName = 'Pflegekasse ist erforderlich.';
    }
    if (required.includes('healthInsurance') && form.costBearerTypes.includes('krankenkasse')) {
      const name = getCostBearerFieldValues(form, 'krankenkasse').name.trim();
      if (!name) errors.healthInsurance = 'Krankenkasse ist erforderlich.';
    }
    if (required.includes('insuranceNumber') && hasGkvCostBearerSelected(form.costBearerTypes) && !form.insuranceNumber.trim()) {
      errors.insuranceNumber = 'Versichertennummer ist erforderlich.';
    }
  }

  if (section === 'notfall_zugang') {
    if (required.includes('emergencyContact')) {
      if (!form.emergencyContactName.trim()) errors.emergencyContactName = 'Notfallkontakt erforderlich.';
      if (!form.emergencyContactPhone.trim()) errors.emergencyContactPhone = 'Notfall-Telefon erforderlich.';
    }
    if (required.includes('homeAccess') && form.homeAccess.length === 0) {
      errors.homeAccess = 'Wohnungszugang ist erforderlich.';
    }
    if (required.includes('facility') && !form.facilityName.trim()) {
      errors.facilityName = 'Einrichtung ist erforderlich.';
    }
    if (required.includes('roomNumber') && !form.roomNumber.trim()) {
      errors.roomNumber = 'Zimmernummer ist erforderlich.';
    }
  }

  if (section === 'versorgung') {
    if (required.includes('consultingReason') && !form.consultingReason.trim()) {
      errors.consultingReason = 'Beratungsanlass ist erforderlich.';
    }
    if (required.includes('consultingType') && !form.consultingType) {
      errors.consultingType = 'Beratungsart ist erforderlich.';
    }
    if (required.includes('familyDoctor') && !form.familyDoctor.trim()) {
      errors.familyDoctor = 'Hausarzt ist erforderlich.';
    }
    if (required.includes('supportWishes') && form.supportWishes.length === 0) {
      errors.supportWishes = 'Gewünschte Unterstützung auswählen.';
    }
  }

  if (section === 'vertraege_einwilligungen') {
    const templates = listApplicableIntakeTemplates(form);
    const docValidation = validateIntakeDocumentsStep(form, templates);
    Object.assign(errors, docValidation.errors);
  }

  return errors;
}

export function hasIntakeErrors(errors: ClientIntakeErrors): boolean {
  return Object.keys(errors).length > 0;
}

export async function submitClientIntake(
  tenantId: string,
  form: ClientIntakeFormData,
  options?: {
    actorProfileId?: string | null;
    draftClientId?: string | null;
    actorRoleKey?: RoleKey | null;
  },
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(options?.actorRoleKey, 'office.clients.create');
  if (denied) return denied;

  return runService(async () => {
    if (!isDemoClientBackend()) {
      const clientResult = await createClientFromIntake(
        tenantId,
        form,
        options?.actorProfileId ?? null,
        options?.draftClientId ?? null,
      );
      if (!clientResult.ok) return clientResult;

      const carrierResult = await persistIntakeCostCarriers(
        tenantId,
        clientResult.data.id,
        form,
        options?.actorProfileId ?? null,
      );
      if (!carrierResult.ok) return carrierResult;

      const extendedResult = await persistIntakeClientExtendedData(
        tenantId,
        clientResult.data.id,
        form,
        options?.actorProfileId ?? null,
      );
      if (!extendedResult.ok) return extendedResult;

      const documentsResult = await persistClientIntakeDocuments(
        tenantId,
        clientResult.data.id,
        form,
        options?.actorProfileId ?? null,
      );
      if (!documentsResult.ok) return documentsResult;

      const portalModules = mapIntakeModulesToPortal(form.assignedModules);
      if (portalModules.length > 0) {
        const moduleResult = await saveClientModuleAssignments(
          tenantId,
          clientResult.data.id,
          portalModules,
          options?.actorProfileId ?? null,
        );
        if (!moduleResult.ok) return moduleResult;
      }

      return { ok: true, data: { id: clientResult.data.id } };
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;

    const id = `client-intake-${Date.now()}`;
    const now = new Date().toISOString();

    persistDemoClientIntake(id, form, now);

    return { ok: true, data: { id } };
  }, { delayMs: 500 });
}

export async function submitClientIntakeUpdate(
  tenantId: string,
  clientId: string,
  form: ClientIntakeFormData,
  options?: { actorProfileId?: string | null; actorRoleKey?: RoleKey | null },
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(options?.actorRoleKey, 'office.clients.edit');
  if (denied) return denied;

  return runService(async () => {
    if (!isDemoClientBackend()) {
      const clientResult = await updateClientFromIntake(
        tenantId,
        clientId,
        form,
        options?.actorProfileId ?? null,
      );
      if (!clientResult.ok) return clientResult;

      const carrierResult = await persistIntakeCostCarriers(
        tenantId,
        clientId,
        form,
        options?.actorProfileId ?? null,
      );
      if (!carrierResult.ok) return carrierResult;

      const extendedResult = await syncIntakeClientExtendedData(
        tenantId,
        clientId,
        form,
        options?.actorProfileId ?? null,
      );
      if (!extendedResult.ok) return extendedResult;

      const documentsResult = await persistClientIntakeDocuments(
        tenantId,
        clientId,
        form,
        options?.actorProfileId ?? null,
      );
      if (!documentsResult.ok) return documentsResult;

      const portalModules = mapIntakeModulesToPortal(form.assignedModules);
      const moduleResult = await saveClientModuleAssignments(
        tenantId,
        clientId,
        portalModules,
        options?.actorProfileId ?? null,
      );
      if (!moduleResult.ok) return moduleResult;

      return { ok: true, data: { id: clientId } };
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;

    const now = new Date().toISOString();
    persistDemoClientIntake(clientId, form, now);

    return { ok: true, data: { id: clientId } };
  }, { delayMs: 500 });
}

function persistDemoClientIntake(clientId: string, form: ClientIntakeFormData, now: string): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { upsertDemoClientIntakeRecord } = require('@/data/demo/clients/intakeRecords');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { upsertDemoClientFullDetail } = require('@/data/demo/clients');
  upsertDemoClientIntakeRecord(clientId, form);
  upsertDemoClientFullDetail(buildMinimalFullDetail(clientId, form, now));
}

function buildMinimalFullDetail(
  id: string,
  form: ClientIntakeFormData,
  now: string,
): import('@/types/modules/client').ClientFullDetail & { careContexts?: ClientCareContext[] } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { helgaSchneiderFull } = require('@/data/demo/clients/helga-schneider');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DEMO_TENANT_ID } = require('@/data/constants/testTenant');
  const base = { ...helgaSchneiderFull };
  const billingType = resolveIntakeBillingProfileType(form.billingTypes);
  const primaryCostBearerName = resolvePrimaryCostBearerName(form);
  const primaryCostBearerRef = resolvePrimaryCostBearerReference(form);

  return {
    ...base,
    id,
    tenantId: DEMO_TENANT_ID,
    firstName: form.firstName,
    lastName: form.lastName,
    dateOfBirth: form.dateOfBirth,
    careLevel: formatCareLevel(form.careLevel) || null,
    status: 'aktiv',
    primaryContactPhone: form.phone || form.mobile,
    city: form.city,
    zip: form.zip,
    street: `${form.street} ${form.houseNumber}`.trim(),
    phone: form.phone,
    email: form.email,
    notes: form.specialNotes,
    createdAt: now,
    updatedAt: now,
    core: {
      ...base.core,
      id,
      tenantId: DEMO_TENANT_ID,
      firstName: form.firstName,
      lastName: form.lastName,
      salutation: form.salutation,
      gender: form.gender as import('@/types/modules/client').ClientCore['gender'],
      dateOfBirth: form.dateOfBirth,
      insuranceNumber: form.insuranceNumber,
      createdAt: now,
      updatedAt: now,
    },
    careLevels: form.careFundName.trim()
      ? [{
          id: `cl-${id}`,
          tenantId: DEMO_TENANT_ID,
          clientId: id,
          grade: form.careLevel || 'kein',
          validFrom: form.careLevelValidFrom || now.slice(0, 10),
          validUntil: null,
          careFundName: form.careFundName.trim(),
          careFundMemberId: form.insuranceNumber.trim() || null,
          mdAssessmentDate: null,
          notes: [form.careFundStreet, form.careFundZip, form.careFundCity].filter(Boolean).join(', ') || null,
          createdAt: now,
          updatedAt: now,
        }]
      : base.careLevels,
    billingProfile: form.billingTypes.length > 0 ? {
      id: `bill-${id}`,
      tenantId: DEMO_TENANT_ID,
      clientId: id,
      billingType,
      hourlyRateCents: form.hourlyRate ? Math.round(parseFloat(form.hourlyRate.replace(',', '.')) * 100) : 3800,
      serviceType: 'betreuung',
      invoiceRecipient: primaryCostBearerName,
      paymentTermsDays: 30,
      costBearerName: primaryCostBearerName,
      costBearerReference: primaryCostBearerRef,
      notes: form.billingTypes.join(', '),
      createdAt: now,
      updatedAt: now,
    } : base.billingProfile,
    careContexts: form.careContexts,
  } as import('@/types/modules/client').ClientFullDetail & { careContexts?: ClientCareContext[] };
}

export function createEmptyIntakeForm(): ClientIntakeFormData {
  return { ...EMPTY_CLIENT_INTAKE_FORM };
}
