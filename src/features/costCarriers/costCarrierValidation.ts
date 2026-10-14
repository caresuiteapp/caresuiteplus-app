import { COST_BEARER_TYPE_CONFIG, TEMPLATE_COST_BEARER_TYPES, type CostBearerTypeKey } from '@/lib/clients/clientIntakeCostBearerConfig';

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

