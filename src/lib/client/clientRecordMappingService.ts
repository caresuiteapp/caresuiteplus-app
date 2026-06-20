import type { ServiceResult } from '@/types';
import type { ClientRecordCompleteness, ClientServiceTypeKey } from '@/types/clientCore';
import type { ClientCareContext, IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';
import {
  getRequiredFieldsForClientContext,
  getVisibleSectionsForClientContext,
} from '@/lib/clients/clientIntakeFieldRules';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { runService } from '@/lib/services/serviceRunner';
import {
  careContextsToServiceTypeKeys,
  listClientServiceProfiles,
  listIntakeSectionsForServiceTypes,
  serviceTypeKeysToCareContexts,
} from './clientServiceTypeService';
import { listClientBudgetSettings } from './clientBudgetSettingsService';
import { fetchClientPortalSettingsResolved } from './clientPortalSettingsService';

const INTAKE_SECTION_ORDER: IntakeSectionKey[] = [
  'leistungsart',
  'stammdaten',
  'adresse_kontakt',
  'versorgung',
  'kostentraeger',
  'angehoerige',
  'notfall_zugang',
  'vertraege_einwilligungen',
  'dokumente',
  'module',
  'pruefung',
];

export function mergeIntakeSectionsFromDbAndRules(
  serviceTypeKeys: ClientServiceTypeKey[],
  careContexts: ClientCareContext[],
  dbSections: { sectionKey: string; isRequired: boolean; sortOrder: number }[],
): IntakeSectionKey[] {
  const fromRules = getVisibleSectionsForClientContext(careContexts);
  if (dbSections.length === 0 || serviceTypeKeys.length === 0) return fromRules;

  const sectionSet = new Set<IntakeSectionKey>();
  for (const section of dbSections) {
    if (INTAKE_SECTION_ORDER.includes(section.sectionKey as IntakeSectionKey)) {
      sectionSet.add(section.sectionKey as IntakeSectionKey);
    }
  }

  sectionSet.add('leistungsart');
  sectionSet.add('pruefung');

  return INTAKE_SECTION_ORDER.filter((key) => sectionSet.has(key));
}

export async function resolveIntakeSectionsForClient(
  tenantId: string,
  clientId: string,
  careContexts: ClientCareContext[],
): Promise<ServiceResult<IntakeSectionKey[]>> {
  return runService(async () => {
    const profilesResult = await listClientServiceProfiles(tenantId, clientId);
    const serviceTypeKeys =
      profilesResult.ok && profilesResult.data.length > 0
        ? profilesResult.data
            .map((p) => p.serviceTypeKey)
            .filter(Boolean) as ClientServiceTypeKey[]
        : careContextsToServiceTypeKeys(careContexts);

    if (serviceTypeKeys.length === 0) {
      return { ok: true, data: getVisibleSectionsForClientContext(careContexts) };
    }

    const sectionsResult = await listIntakeSectionsForServiceTypes(tenantId, serviceTypeKeys);
    if (!sectionsResult.ok) return sectionsResult;

    const merged = mergeIntakeSectionsFromDbAndRules(
      serviceTypeKeys,
      serviceTypeKeysToCareContexts(serviceTypeKeys),
      sectionsResult.data,
    );

    return { ok: true, data: merged };
  });
}

export function computeRecordCompleteness(
  form: Partial<ClientIntakeFormData>,
  careContexts: ClientCareContext[],
  options: {
    configuredServiceTypes: number;
    hasBudgetSettings: boolean;
    hasPortalSettings: boolean;
  },
): ClientRecordCompleteness {
  const required = getRequiredFieldsForClientContext(careContexts);
  const missingSections: string[] = [];

  if (options.configuredServiceTypes === 0) missingSections.push('leistungsbereiche');
  if (!options.hasBudgetSettings) missingSections.push('budget');
  if (!options.hasPortalSettings) missingSections.push('portal');

  const fieldChecks: Record<string, boolean> = {
    careContexts: (form.careContexts?.length ?? 0) > 0,
    firstName: Boolean(form.firstName?.trim()),
    lastName: Boolean(form.lastName?.trim()),
    dateOfBirth: Boolean(form.dateOfBirth?.trim()),
    street: Boolean(form.street?.trim()),
    zip: Boolean(form.zip?.trim()),
    city: Boolean(form.city?.trim()),
    phoneOrContact: Boolean(form.phone?.trim() || form.mobile?.trim() || form.email?.trim()),
    serviceStart: Boolean(form.serviceStart?.trim()),
    billingTypes: (form.billingTypes?.length ?? 0) > 0,
    emergencyContact: Boolean(form.emergencyContactName?.trim()),
    consentDatenschutz: form.consentDatenschutz === true,
    consentVertrag: form.consentVertrag === true,
  };

  const filledRequired = required.filter((field) => fieldChecks[field] !== false).length;
  const sectionScore = missingSections.length === 0 ? 1 : Math.max(0, 1 - missingSections.length * 0.15);
  const fieldScore = required.length > 0 ? filledRequired / required.length : 1;
  const scorePct = Math.round((fieldScore * 0.7 + sectionScore * 0.3) * 100);

  return {
    scorePct,
    missingSections,
    configuredServiceTypes: options.configuredServiceTypes,
    hasBudgetSettings: options.hasBudgetSettings,
    hasPortalSettings: options.hasPortalSettings,
  };
}

export async function fetchClientRecordCompleteness(
  tenantId: string,
  clientId: string,
  form: Partial<ClientIntakeFormData>,
  careContexts: ClientCareContext[],
): Promise<ServiceResult<ClientRecordCompleteness>> {
  return runService(async () => {
    const [profiles, budgets, portal] = await Promise.all([
      listClientServiceProfiles(tenantId, clientId),
      listClientBudgetSettings(tenantId, clientId),
      fetchClientPortalSettingsResolved(tenantId, clientId),
    ]);

    const completeness = computeRecordCompleteness(form, careContexts, {
      configuredServiceTypes: profiles.ok ? profiles.data.length : 0,
      hasBudgetSettings: budgets.ok ? budgets.data.length > 0 : false,
      hasPortalSettings: portal.ok ? portal.data.portalEnabled || portal.data.inheritTenantDefaults : false,
    });

    return { ok: true, data: completeness };
  });
}

export function mapCareContextsToServiceTypeLabels(contexts: ClientCareContext[]): string[] {
  return careContextsToServiceTypeKeys(contexts).map((key) => key.replace(/_/g, ' '));
}
