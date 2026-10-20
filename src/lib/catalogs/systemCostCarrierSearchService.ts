import {
  SYSTEM_COST_CARRIER_TEMPLATES,
  type SystemCostCarrierTemplate,
  type SystemCostCarrierType,
} from './systemCostCarrierTemplates';

export function listSystemCostCarrierTemplates(type?: SystemCostCarrierType): SystemCostCarrierTemplate[] {
  if (!type) return [...SYSTEM_COST_CARRIER_TEMPLATES];
  return SYSTEM_COST_CARRIER_TEMPLATES.filter((entry) => entry.type === type);
}

export function searchSystemCostCarrierTemplates(
  query: string,
  type?: SystemCostCarrierType,
  limit = 8,
): SystemCostCarrierTemplate[] {
  const normalized = query.trim().toLowerCase();
  const pool = listSystemCostCarrierTemplates(type);
  if (!normalized) return pool.slice(0, limit);

  return pool
    .filter((entry) => {
      const haystack = [
        entry.name,
        entry.department,
        entry.city,
        entry.zip,
        entry.street,
        entry.ikNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    })
    .slice(0, limit);
}

export function getSystemCostCarrierTemplate(id: string): SystemCostCarrierTemplate | null {
  return SYSTEM_COST_CARRIER_TEMPLATES.find((entry) => entry.id === id) ?? null;
}
