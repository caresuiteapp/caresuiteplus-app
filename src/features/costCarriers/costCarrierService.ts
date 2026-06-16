import type { ServiceResult } from '@/types';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import {
  COST_BEARER_TYPE_CONFIG,
  getCostBearerFieldValues,
  isCostBearerTypeKey,
  MANUAL_COST_BEARER_TYPES,
  TEMPLATE_COST_BEARER_TYPES,
  type CostBearerTypeKey,
} from '@/lib/clients/clientIntakeCostBearerConfig';
import {
  searchSystemCostCarrierTemplates,
} from '@/lib/catalogs/systemCostCarrierSearchService';
import type { SystemCostCarrierType } from '@/lib/catalogs/systemCostCarrierTemplates';
import { getServiceMode } from '@/lib/services/mode';
import type {
  CostCarrierAddressSnapshot,
  CostCarrierDbType,
  CostCarrierSearchResult,
  CostCarrierSystemTemplate,
} from './costCarrierTypes';
import {
  formatCostCarrierAddress,
  mapUiCostBearerTypeToDbCarrierType,
} from './costCarrierTypes';
import {
  insertClientCostCarrierAssignment,
  insertTenantCostCarrierOverride,
  searchCostCarrierSystemTemplatesRemote,
} from './costCarrierRepository';

export const COST_CARRIER_SEARCH_MIN_QUERY_LENGTH = 2;
export const COST_CARRIER_SEARCH_DEBOUNCE_MS = 300;
const IK_NUMBER_PATTERN = /^\d{9}$/;

export function usesSystemTemplateSearch(type: CostBearerTypeKey): boolean {
  return (TEMPLATE_COST_BEARER_TYPES as readonly string[]).includes(type);
}

export function validateCostBearerIk(ikNumber: string): string | null {
  const trimmed = ikNumber.trim();
  if (!trimmed) return null;
  if (!IK_NUMBER_PATTERN.test(trimmed)) {
    return 'IK-Nummer muss genau 9 Ziffern haben.';
  }
  return null;
}

export function validateCostBearerEntry(
  type: CostBearerTypeKey,
  values: { name: string; street: string; zip: string; city: string; ikNumber: string },
): string | null {
  const config = COST_BEARER_TYPE_CONFIG[type];

  if (type === 'beihilfe' || type === 'sonstiger') {
    if (!values.name.trim()) return `${config.label} — Name ist erforderlich.`;
  }

  if (type === 'selbstzahler') {
    if (!values.name.trim()) return 'Rechnungsempfänger ist erforderlich.';
  }

  if (usesSystemTemplateSearch(type) && !values.name.trim()) {
    return `${config.label} ist erforderlich.`;
  }

  return validateCostBearerIk(values.ikNumber);
}

export function buildCostCarrierAddressSnapshot(values: {
  street: string;
  zip: string;
  city: string;
}): CostCarrierAddressSnapshot {
  return {
    street: values.street.trim(),
    postalCode: values.zip.trim(),
    city: values.city.trim(),
    country: 'DE',
  };
}

function mapStaticTypeToDb(uiType: CostBearerTypeKey): CostCarrierDbType | null {
  return mapUiCostBearerTypeToDbCarrierType(uiType);
}

function mapStaticTemplateToSystem(entry: ReturnType<typeof searchSystemCostCarrierTemplates>[number]): CostCarrierSystemTemplate {
  const dbType = mapStaticTypeToDb(entry.type as CostBearerTypeKey);
  if (!dbType) {
    throw new Error(`Unbekannter Kostenträgertyp: ${entry.type}`);
  }
  return {
    id: entry.id,
    templateKey: entry.id,
    carrierType: dbType,
    uiLabel: entry.department ?? entry.name,
    name: entry.name,
    legalName: null,
    shortName: null,
    ikNumber: entry.ikNumber,
    street: entry.street,
    zip: entry.zip,
    city: entry.city,
    federalState: null,
    country: 'DE',
    phone: null,
    fax: null,
    email: null,
    website: null,
    dataStatus: 'static',
    notes: entry.department,
  };
}

export async function searchCostCarrierTemplates(
  uiType: CostBearerTypeKey,
  query: string,
  limit = 8,
): Promise<CostCarrierSearchResult> {
  if (!usesSystemTemplateSearch(uiType)) {
    return { ok: true, data: [] };
  }

  const dbType = mapUiCostBearerTypeToDbCarrierType(uiType);
  if (!dbType) {
    return { ok: true, data: [] };
  }

  if (getServiceMode() === 'supabase') {
    return searchCostCarrierSystemTemplatesRemote(dbType, query, limit);
  }

  const staticType = COST_BEARER_TYPE_CONFIG[uiType].templateType as SystemCostCarrierType | undefined;
  const results = searchSystemCostCarrierTemplates(query, staticType, limit).map(mapStaticTemplateToSystem);
  return { ok: true, data: results };
}

function resolveAssignmentCarrierType(type: CostBearerTypeKey): string {
  return mapUiCostBearerTypeToDbCarrierType(type) ?? type;
}

function isCareLevelRelevant(type: CostBearerTypeKey): boolean {
  return type === 'pflegekasse';
}

function needsTenantOverride(
  type: CostBearerTypeKey,
  systemTemplateId: string | undefined,
): boolean {
  return usesSystemTemplateSearch(type) && !systemTemplateId;
}

export async function persistIntakeCostCarriers(
  tenantId: string,
  clientId: string,
  form: ClientIntakeFormData,
  actorProfileId?: string | null,
): Promise<ServiceResult<void>> {
  const committedTypes = form.costBearerTypes.filter(isCostBearerTypeKey);
  const primaryByCarrierType = new Map<string, boolean>();

  for (const type of committedTypes) {
    const values = getCostBearerFieldValues(form, type);
    const validationError = validateCostBearerEntry(type, values);
    if (validationError) {
      return { ok: false, error: validationError };
    }

    const carrierType = resolveAssignmentCarrierType(type);
    if (primaryByCarrierType.has(carrierType)) {
      return { ok: false, error: `Nur ein primärer Kostenträger pro Typ (${carrierType}) erlaubt.` };
    }
    primaryByCarrierType.set(carrierType, true);

    const systemTemplateId = form.costBearerTemplateIds[type];
    let tenantOverrideId: string | null = null;

    if (needsTenantOverride(type, systemTemplateId)) {
      const overrideResult = await insertTenantCostCarrierOverride({
        tenant_id: tenantId,
        carrier_type: carrierType,
        custom_name: values.name.trim(),
        custom_ik_number: values.ikNumber.trim() || null,
        custom_address_line_1: values.street.trim() || null,
        custom_postal_code: values.zip.trim() || null,
        custom_city: values.city.trim() || null,
        created_by: actorProfileId ?? null,
        updated_by: actorProfileId ?? null,
      });
      if (!overrideResult.ok) return overrideResult;
      tenantOverrideId = overrideResult.data.id;
    }

    const assignmentResult = await insertClientCostCarrierAssignment({
      tenant_id: tenantId,
      client_id: clientId,
      carrier_type: carrierType,
      system_template_id: systemTemplateId ?? null,
      tenant_override_id: tenantOverrideId,
      name_snapshot: values.name.trim(),
      ik_number_snapshot: values.ikNumber.trim() || null,
      address_snapshot: buildCostCarrierAddressSnapshot(values),
      insurance_number:
        (type === 'pflegekasse' || type === 'krankenkasse') && form.insuranceNumber.trim()
          ? form.insuranceNumber.trim()
          : null,
      care_level_relevant: isCareLevelRelevant(type),
      billing_relevant: true,
      is_primary: true,
      created_by: actorProfileId ?? null,
      updated_by: actorProfileId ?? null,
    });

    if (!assignmentResult.ok) return assignmentResult;
  }

  return { ok: true, data: undefined };
}

export { formatCostCarrierAddress, mapUiCostBearerTypeToDbCarrierType };

export function isManualCostBearerType(type: CostBearerTypeKey): boolean {
  return (MANUAL_COST_BEARER_TYPES as readonly string[]).includes(type);
}
