import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import { resolvePrimaryCostBearerName } from '@/lib/clients/clientIntakeCostBearerConfig';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import {
  CARE_CONTEXT_TO_SERVICE_TYPE,
  CONTRACT_TEMPLATE_BY_SERVICE_TYPE,
  type IntakeContractTypeKey,
  type IntakeDocumentTemplate,
  PRIVACY_TEMPLATE_KEY,
  ASSIGNMENT_TEMPLATE_KEY,
  OPTIONAL_CONSENT_TEMPLATE_KEYS,
} from './intakeDocumentTypes';
import { formatCareLevel, formatSalutation } from '@/lib/formatters/unitFormatters';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import type { TenantDisplayMeta } from '@/lib/tenant/tenantDisplayMeta';
import { getSystemIntakeTemplateByKey } from './intakeDocumentSystemTemplates';
import {
  buildCostCarrierMergeFields,
  buildFamilyDoctorClause,
} from './intakeCostCarrierMerge';

export type IntakePlaceholderContext = Record<string, string>;

export type IntakeTenantDisplay = Partial<Pick<TenantDisplayMeta, 'name' | 'street' | 'zip' | 'city'>> & {
  defaultHourlyRate?: string;
};

export function buildIntakePlaceholderContext(
  form: ClientIntakeFormData,
  tenantDisplay?: IntakeTenantDisplay,
): IntakePlaceholderContext {
  const fullName = [form.firstName, form.lastName].filter(Boolean).join(' ').trim();
  const streetLine = [form.street, form.houseNumber].filter(Boolean).join(' ').trim();
  const tenantName = tenantDisplay?.name?.trim() || 'Pflegedienst (Mandant)';
  const costCarrierFields = buildCostCarrierMergeFields(form, tenantName);

  return {
    'tenant.name': tenantName,
    'tenant.street': tenantDisplay?.street?.trim() || '',
    'tenant.zip': tenantDisplay?.zip?.trim() || '',
    'tenant.city': tenantDisplay?.city?.trim() || '',
    'client.salutation': formatSalutation(form.salutation),
    'client.first_name': form.firstName.trim(),
    'client.last_name': form.lastName.trim(),
    'client.full_name': fullName,
    'client.date_of_birth': formatDate(form.dateOfBirth),
    'client.street': streetLine,
    'client.zip': form.zip.trim(),
    'client.city': form.city.trim(),
    'client.phone': form.phone.trim() || form.mobile.trim(),
    'client.email': form.email.trim(),
    'client.insurance_number': form.insuranceNumber.trim(),
    'cost_carrier.primary_name': resolvePrimaryCostBearerName(form) ?? costCarrierFields['cost_carrier.primary_name'],
    ...costCarrierFields,
    'care.level': formatCareLevel(form.careLevel),
    'billing.types': form.billingTypes.join(', '),
    'billing.hourly_rate': form.hourlyRate.trim() || '—',
    'contract.service_start': formatDate(form.serviceStart.trim() || form.admissionDate.trim()),
    'document.date': formatDate(new Date()),
    'document.location': form.city.trim() || tenantDisplay?.city?.trim() || '—',
    'intake.date': formatDate(form.serviceStart.trim() || form.admissionDate.trim()) || formatDate(new Date()),
    'intake.location': form.city.trim() || tenantDisplay?.city?.trim() || '—',
    'service.type': form.careContexts.join(', ') || form.intakeContractType || '—',
    'facility.name': form.facilityName.trim(),
    'facility.care_area': form.careArea,
    'facility.room_number': form.roomNumber.trim(),
    'consulting.reason': form.consultingReason.trim(),
    'consulting.type': form.consultingType,
    'consulting.family_doctor': form.familyDoctor.trim(),
    'consulting.family_doctor_clause': buildFamilyDoctorClause(form),
    'emergency.name': form.emergencyContactName.trim(),
    'emergency.phone': form.emergencyContactPhone.trim(),
    'signature.client': '',
    'signature.employee': '',
    'signature.legal_representative': '',
  };
}

export function resolveIntakeContractType(
  form: ClientIntakeFormData,
): IntakeContractTypeKey | null {
  if (form.intakeContractType) {
    return form.intakeContractType as IntakeContractTypeKey;
  }
  for (const ctx of form.careContexts) {
    const mapped = CARE_CONTEXT_TO_SERVICE_TYPE[ctx as ClientCareContext];
    if (mapped) return mapped;
  }
  return null;
}

export function resolveContractTemplateKey(form: ClientIntakeFormData): string | null {
  const contractType = resolveIntakeContractType(form);
  if (!contractType) return null;
  return CONTRACT_TEMPLATE_BY_SERVICE_TYPE[contractType] ?? null;
}

export function listApplicableIntakeTemplates(
  form: ClientIntakeFormData,
  tenantTemplates: IntakeDocumentTemplate[] = [],
): IntakeDocumentTemplate[] {
  const lookup = new Map<string, IntakeDocumentTemplate>();
  for (const template of tenantTemplates) {
    lookup.set(template.templateKey, template);
  }

  const contractKey = resolveContractTemplateKey(form);
  const applicableKeys: string[] = [
    PRIVACY_TEMPLATE_KEY,
    ...(contractKey ? [contractKey] : []),
  ];

  if (form.intakeAssignmentEnabled) {
    applicableKeys.push(ASSIGNMENT_TEMPLATE_KEY);
  }

  for (const key of form.intakeOptionalConsents) {
    if (OPTIONAL_CONSENT_TEMPLATE_KEYS.includes(key as (typeof OPTIONAL_CONSENT_TEMPLATE_KEYS)[number])) {
      applicableKeys.push(key);
    }
  }

  const result: IntakeDocumentTemplate[] = [];
  for (const key of applicableKeys) {
    const template = lookup.get(key) ?? getSystemIntakeTemplateByKey(key);
    if (template?.isActive) {
      result.push(template);
    }
  }
  return result;
}

export function resolveBillingHourlyRate(
  form: ClientIntakeFormData,
  tenant?: { name?: string; defaultHourlyRate?: string } | null,
): string {
  const formRate = (form as Record<string, unknown>).hourlyRate;
  if (typeof formRate === 'string' && formRate.trim()) return formRate.trim();
  return tenant?.defaultHourlyRate ?? '';
}

export function listAvailableContractTypes(contexts: ClientCareContext[]): IntakeContractTypeKey[] {
  const types = new Set<IntakeContractTypeKey>();
  for (const ctx of contexts) {
    const mapped = CARE_CONTEXT_TO_SERVICE_TYPE[ctx];
    if (mapped) types.add(mapped);
  }
  if (types.size === 0) {
    types.add('assist');
  }
  return [...types];
}
