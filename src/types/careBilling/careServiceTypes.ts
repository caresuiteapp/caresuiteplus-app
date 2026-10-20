/** Leistungsarten für Pflege/Betreuungsabrechnung — Prompt 64 */

export type CareServiceAreaKey =
  | 'entlastungsleistungen'
  | 'alltagsbegleitung'
  | 'hauswirtschaft'
  | 'betreuung'
  | 'pflegeberatung'
  | 'pflegeleistungen'
  | 'selbstzahlerleistungen'
  | 'fahrtkosten'
  | 'zusatzleistungen';

export const CARE_SERVICE_AREA_LABELS: Record<CareServiceAreaKey, string> = {
  entlastungsleistungen: 'Entlastungsleistungen / Unterstützung im Alltag',
  alltagsbegleitung: 'Alltagsbegleitung',
  hauswirtschaft: 'Hauswirtschaft',
  betreuung: 'Betreuung',
  pflegeberatung: 'Pflegeberatung',
  pflegeleistungen: 'Pflegeleistungen',
  selbstzahlerleistungen: 'Selbstzahlerleistungen',
  fahrtkosten: 'Fahrtkosten',
  zusatzleistungen: 'Zusatzleistungen',
};

/** Leistungsarten mit voller Abrechnungsunterstützung (kein preparedOnly). */
export const CARE_SERVICE_AREAS_ACTIVE: CareServiceAreaKey[] = [
  'entlastungsleistungen',
  'alltagsbegleitung',
  'hauswirtschaft',
  'betreuung',
  'selbstzahlerleistungen',
];

/** Leistungsarten strukturell vorbereitet — keine produktive Abrechnung ohne Freigabe. */
export const CARE_SERVICE_AREAS_PREPARED: CareServiceAreaKey[] = [
  'pflegeberatung',
  'pflegeleistungen',
  'fahrtkosten',
  'zusatzleistungen',
];

export type ServiceCatalogItem = {
  id: string;
  tenantId: string;
  serviceAreaKey: CareServiceAreaKey;
  code: string;
  label: string;
  isBillable: boolean;
  isPreparedOnly: boolean;
  defaultBillingUnit: BillingUnit;
  createdAt: string;
  updatedAt: string;
};

export type BillingUnit = 'hour' | 'visit' | 'flat' | 'minute';

export type RoundingRule = 'none' | 'up_to_quarter_hour' | 'up_to_half_hour' | 'commercial';

export type TravelCostRule = 'none' | 'per_km' | 'flat_per_visit' | 'prepared';

export function isCareServiceAreaActive(key: CareServiceAreaKey): boolean {
  return CARE_SERVICE_AREAS_ACTIVE.includes(key);
}

export function isCareServiceAreaPreparedOnly(key: CareServiceAreaKey): boolean {
  return CARE_SERVICE_AREAS_PREPARED.includes(key);
}
