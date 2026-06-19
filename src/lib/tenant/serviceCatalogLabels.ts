import type { ServicePriceUnit, ServiceTaxMode, TenantModuleKey } from '@/types/tenant/tenantCenter';

export const TENANT_MODULE_LABELS: Record<TenantModuleKey, string> = {
  assist: 'Assist',
  pflege: 'Pflege',
  stationaer: 'Stationär',
  beratung: 'Beratung',
};

const SERVICE_PRICE_UNIT_LABELS: Record<ServicePriceUnit, string> = {
  hour: 'Stunde',
  visit: 'Besuch',
  day: 'Tag',
  flat: 'Pauschale',
  km: 'Kilometer',
  percent: 'Prozent',
};

const SERVICE_TAX_MODE_LABELS: Record<ServiceTaxMode, string> = {
  exempt_4_16: 'Steuerbefreit § 4 Nr. 16 UStG',
  standard_19: 'Umsatzsteuer 19 %',
  kleinunternehmer_19: 'Kleinunternehmer § 19 UStG',
  none: 'Keine Umsatzsteuer',
};

export const SERVICE_TAX_MODE_OPTIONS: Array<{ key: ServiceTaxMode; label: string }> = (
  Object.entries(SERVICE_TAX_MODE_LABELS) as Array<[ServiceTaxMode, string]>
).map(([key, label]) => ({ key, label }));

export function formatServicePriceUnit(unit: ServicePriceUnit): string {
  return SERVICE_PRICE_UNIT_LABELS[unit] ?? unit;
}

export function formatServicePriceUnitShort(unit: ServicePriceUnit): string {
  switch (unit) {
    case 'hour':
      return 'Std.';
    case 'visit':
      return 'Bes.';
    case 'day':
      return 'Tag';
    case 'flat':
      return 'Psch.';
    case 'km':
      return 'km';
    case 'percent':
      return '%';
    default:
      return formatServicePriceUnit(unit);
  }
}

export function formatServiceTaxMode(mode: ServiceTaxMode | null | undefined): string {
  if (!mode) return '—';
  return SERVICE_TAX_MODE_LABELS[mode] ?? mode;
}
