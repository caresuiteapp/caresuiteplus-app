import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import {
  getCostBearerFieldValues,
  resolvePrimaryCostBearerName,
} from '@/lib/clients/clientIntakeCostBearerConfig';
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
import { getSystemIntakeTemplateByKey } from './intakeDocumentSystemTemplates';

export type IntakePlaceholderContext = Record<string, string>;

export function buildIntakePlaceholderContext(
  form: ClientIntakeFormData,
  tenantDisplay?: { name?: string; street?: string; zip?: string; city?: string },
): IntakePlaceholderContext {
  const careFund = getCostBearerFieldValues(form, 'pflegekasse');
  const healthInsurance = getCostBearerFieldValues(form, 'krankenkasse');
  const fullName = [form.firstName, form.lastName].filter(Boolean).join(' ').trim();
  const streetLine = [form.street, form.houseNumber].filter(Boolean).join(' ').trim();

  return {
    'tenant.name': tenantDisplay?.name?.trim() || 'Pflegedienst (Mandant)',
    'tenant.street': tenantDisplay?.street?.trim() || '',
    'tenant.zip': tenantDisplay?.zip?.trim() || '',
    'tenant.city': tenantDisplay?.city?.trim() || '',
    'client.salutation': formatSalutation(form.salutation),
    'client.first_name': form.firstName.trim(),
    'client.last_name': form.lastName.trim(),
    'client.full_name': fullName,
    'client.date_of_birth': form.dateOfBirth,
    'client.street': streetLine,
    'client.zip': form.zip.trim(),
    'client.city': form.city.trim(),
    'client.phone': form.phone.trim() || form.mobile.trim(),
    'client.email': form.email.trim(),
    'client.insurance_number': form.insuranceNumber.trim(),
    'cost_carrier.primary_name': resolvePrimaryCostBearerName(form) ?? '',
    'cost_carrier.care_fund_name': careFund.name.trim() || form.careFundName.trim(),
    'cost_carrier.care_fund_ik': careFund.ikNumber.trim() || form.costBearerIk.trim(),
    'cost_carrier.health_insurance_name': healthInsurance.name.trim() || form.healthInsurance.trim(),
    'care.level': formatCareLevel(form.careLevel),
    'billing.types': form.billingTypes.join(', '),
    'billing.hourly_rate': form.hourlyRate.trim() || '—',
    'contract.service_start': form.serviceStart.trim() || form.admissionDate.trim(),
    'document.date': new Date().toLocaleDateString('de-DE'),
    'document.location': form.city.trim() || tenantDisplay?.city?.trim() || '—',
    'intake.date': form.serviceStart.trim() || form.admissionDate.trim() || new Date().toLocaleDateString('de-DE'),
    'intake.location': form.city.trim() || tenantDisplay?.city?.trim() || '—',
    'service.type': form.careContexts.join(', ') || form.intakeContractType || '—',
    'facility.name': form.facilityName.trim(),
    'facility.care_area': form.careArea,
    'facility.room_number': form.roomNumber.trim(),
    'consulting.reason': form.consultingReason.trim(),
    'consulting.type': form.consultingType,
    'consulting.family_doctor': form.familyDoctor.trim(),
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
