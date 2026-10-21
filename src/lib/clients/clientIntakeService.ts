import { resolveAuthenticatedProfileId } from '@/lib/auth/resolveAuthenticatedProfile';
import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types/core/auth';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import {
  getRequiredFieldsForClientContext,
  getVisibleSectionsForClientContext,
  type IntakeSectionKey,
} from '@/lib/clients/clientIntakeFieldRules';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
import { runService } from '@/lib/services/serviceRunner';
import { enforcePermission } from '@/lib/permissions';
import { assertDemoTenant, isDemoClientBackend } from './clientBackend';
import {
  resolvePrimaryCostBearerName,
  resolvePrimaryCostBearerReference,
} from './clientIntakeCostBearerConfig';
import { resolveIntakeBillingProfileType } from './clientIntakeBilling';
import { persistIntakeCostCarriers } from '@/features/costCarriers/costCarrierService';
import { persistClientIntakeDocuments } from '@/features/intakeDocuments/intakeDocumentService';
import { syncCareLevelDependentDocuments } from '@/lib/clients/clientCareLevelDocumentSync';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isUuid } from '@/lib/validation/uuid';
import {
  updateClientFromIntake,
} from './repositories/clientIntakeRepository.supabase';
import { mapIntakeModulesToPortal, saveClientModuleAssignments } from '@/lib/portal/clientModuleAssignmentService';
import { syncIntakeClientExtendedData } from './clientIntakePersistence';
import { syncClientCoreAfterIntake } from '@/lib/client/clientCoreIntakeSyncService';

import {
  careContextsToServiceTypeKeys,
  serviceTypeKeysToCareContexts,
} from '@/lib/client/clientServiceTypeService';
import { mergeIntakeSectionsFromDbAndRules } from '@/lib/client/clientRecordMappingService';
import { validateIntakeStep } from './clientIntakeValidation';
import { getIntakeSectionsForForm } from './clientIntakePlan';

export function getIntakeStepsForContexts(contexts: ClientCareContext[]): IntakeSectionKey[] {
  return getVisibleSectionsForClientContext(contexts);
}

/** Sync helper for tests — merges DB-shaped sections with legacy rules. */
export function getIntakeStepsForServiceTypeKeys(
  serviceTypeKeys: ReturnType<typeof careContextsToServiceTypeKeys>,
  careContexts: ClientCareContext[],
  dbSections: { sectionKey: string; isRequired: boolean; sortOrder: number }[] = [],
): IntakeSectionKey[] {
  return mergeIntakeSectionsFromDbAndRules(serviceTypeKeys, careContexts, dbSections);
}

export function getRequiredFieldsForServiceTypes(
  serviceTypeKeys: import('@/types/clientCore').ClientServiceTypeKey[],
): ReturnType<typeof getRequiredFieldsForClientContext> {
  return getRequiredFieldsForClientContext(serviceTypeKeysToCareContexts(serviceTypeKeys));
}

export { getServiceIntakeSections } from '@/lib/client/clientServiceTypeService';
export { careContextsToServiceTypeKeys, serviceTypeKeysToCareContexts };

export { validateIntakeStep, hasIntakeErrors } from './clientIntakeValidation';

export type ClientIntakeSubmissionResult = ServiceResult<{ id: string }> & { recoverableClientId?: string; conflict?: boolean };

export async function submitClientIntake(
  tenantId: string,
  form: ClientIntakeFormData,
  options?: {
    actorProfileId?: string | null;
    draftClientId?: string | null;
    expectedRevision?: number;
    actorRoleKey?: RoleKey | null;
  },
): Promise<ClientIntakeSubmissionResult> {
  const denied = enforcePermission<{ id: string }>(options?.actorRoleKey, 'office.clients.create');
  if (denied) return denied;
  const validationErrors = getIntakeSectionsForForm(form)
    .flatMap((section) => Object.values(validateIntakeStep(section, form)));
  if (validationErrors.length) return { ok: false, error: validationErrors.join(' '), recoverableClientId: options?.draftClientId ?? undefined };

  const recoverableClientId = options?.draftClientId ?? undefined;
  const result = await runService(async () => {
    if (!isDemoClientBackend()) {
      const expectedRevision = options?.expectedRevision;
      if (!isUuid(tenantId) || !isUuid(recoverableClientId) || !Number.isSafeInteger(expectedRevision) || (expectedRevision ?? 0) < 1) {
        return { ok: false, error: 'Bitte sichern Sie die vollständige Aufnahme zuerst auf dem Server.', recoverableClientId };
      }
      const supabase = getSupabaseClient();
      if (!supabase) return { ok: false, error: 'Der Aufnahmeabschluss ist derzeit nicht erreichbar. Bitte denselben Speicherstand erneut versuchen; ein bereits erfolgter Abschluss wird erkannt.', recoverableClientId };
      const { data, error } = await supabase.functions.invoke('complete-client-intake', {
        body: { tenantId, clientId: recoverableClientId, expectedRevision },
      });
      if (error) {
        let message = 'Der Aufnahmeabschluss konnte nicht bestätigt werden. Bitte denselben Speicherstand erneut versuchen; ein bereits erfolgter Abschluss wird erkannt.';
        try {
          const response = error.context as Response | undefined;
          const body: unknown = response?.clone ? await response.clone().json() : null;
          if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') message = body.error;
        } catch { /* Keep the truthful fallback when the server body is unavailable. */ }
        return { ok: false, error: message, recoverableClientId, conflict: (error.context as Response | undefined)?.status === 409 };
      }
      const receipt = data?.data;
      if (data?.ok !== true || receipt?.contract !== 'client-intake-completion-v1' ||
          receipt.clientId !== recoverableClientId || receipt.revision !== expectedRevision ||
          receipt.status !== 'active' || receipt.confirmed !== true || typeof receipt.replayed !== 'boolean') {
        return { ok: false, error: typeof data?.error === 'string' ? data.error : 'Die Abschlussbestätigung ist unvollständig. Bitte denselben Speicherstand erneut versuchen; ein bereits erfolgter Abschluss wird erkannt.', recoverableClientId };
      }
      return { ok: true, data: { id: recoverableClientId } };
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;

    const id = `client-intake-${Date.now()}`;
    const now = new Date().toISOString();

    persistDemoClientIntake(id, form, now);

    return { ok: true, data: { id } };
  }, { delayMs: 500 });
  return !result.ok && recoverableClientId ? { ...result, recoverableClientId } : result;
}

export async function submitClientIntakeUpdate(
  tenantId: string,
  clientId: string,
  form: ClientIntakeFormData,
  options?: {
    actorProfileId?: string | null;
    actorRoleKey?: RoleKey | null;
    sections?: IntakeSectionKey[];
  },
): Promise<ClientIntakeSubmissionResult> {
  const denied = enforcePermission<{ id: string }>(options?.actorRoleKey, 'office.clients.edit');
  if (denied) return denied;

  return runService(async () => {
    if (!isDemoClientBackend()) {
      const includesDocuments = !options?.sections?.length || options.sections.includes('vertraege_einwilligungen');
      if (includesDocuments && form.intakeDocuments.some(doc => doc.status === 'finalized' || Boolean(doc.finalizedAt || doc.finalizedHtml) || Object.values(doc.signatures).some(signature => signature?.dataUrl))) {
        return { ok: false, error: 'Unterschriebene Aufnahmeunterlagen bleiben unveränderlich. Bitte persönliche Angaben im jeweiligen Aktenabschnitt bearbeiten und neue Vereinbarungen erneut zur Prüfung vorbereiten. Vorhandene Originale bleiben erhalten.', recoverableClientId: clientId };
      }
      const actor = await resolveAuthenticatedProfileId(tenantId);
      if (!actor.ok) return actor;
      if (options?.actorProfileId && options.actorProfileId !== actor.data) return { ok: false, error: 'Die handelnde Profilzuordnung stimmt nicht mit Ihrer Anmeldung überein.' };
      const shouldPersist = (section: IntakeSectionKey): boolean =>
        !options?.sections?.length || options.sections.includes(section);

      let previousCareLevel: string | null = null;
      if (shouldPersist('versorgung') || shouldPersist('kostentraeger')) {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data, error } = await supabase
            .from('clients')
            .select('care_level')
            .eq('tenant_id', tenantId)
            .eq('id', clientId)
            .maybeSingle();
          if (error || !data) return { ok: false, error: 'Die bisherige Pflegegradeinstufung konnte nicht geladen werden. Bitte erneut laden.' };
          previousCareLevel = data.care_level ?? null;
        }
      }

      const clientResult = await updateClientFromIntake(
        tenantId,
        clientId,
        form,
        actor.data,
        options?.sections,
      );
      if (!clientResult.ok) return clientResult;

      if (shouldPersist('kostentraeger')) {
        const carrierResult = await persistIntakeCostCarriers(
          tenantId,
          clientId,
          form,
          actor.data,
        );
        if (!carrierResult.ok) return carrierResult;
      }

      const extendedSections: IntakeSectionKey[] = [
        'leistungsart',
        'adresse_kontakt',
        'kostentraeger',
        'angehoerige',
        'notfall_zugang',
        'versorgung',
      ];
      if (extendedSections.some(shouldPersist)) {
        const extendedResult = await syncIntakeClientExtendedData(
          tenantId,
          clientId,
          form,
          actor.data,
          { sections: options?.sections },
        );
        if (!extendedResult.ok) return extendedResult;
      }

      if (shouldPersist('versorgung') || shouldPersist('kostentraeger')) {
        const documentSync = await syncCareLevelDependentDocuments({
          tenantId,
          clientId,
          previousCareLevel,
          form,
          actorProfileId: actor.data,
        });
        if (!documentSync.ok) return documentSync;
      }

      if (shouldPersist('vertraege_einwilligungen')) {
        const documentsResult = await persistClientIntakeDocuments(
          tenantId,
          clientId,
          form,
          actor.data,
        );
        if (!documentsResult.ok) return documentsResult;
      }

      if (shouldPersist('module')) {
        const portalModules = mapIntakeModulesToPortal(form.assignedModules);
        const moduleResult = await saveClientModuleAssignments(
          tenantId,
          clientId,
          portalModules,
          actor.data,
        );
        if (!moduleResult.ok) return moduleResult;
      }

      if (shouldPersist('leistungsart')) {
        const coreSync = await syncClientCoreAfterIntake(tenantId, clientId, form);
        if (!coreSync.ok) return { ...coreSync, recoverableClientId: clientId };
      }

      // An unrelated section edit cannot prove that a partial intake is complete.
      // Activation belongs to the explicitly verified intake completion workflow.

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
