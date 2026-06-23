import { PRODUCT_LABELS } from '@/data/constants/productLabels';
import type { ProductKey } from '@/types';
import type { EffectiveModuleAccess } from '@/types';
import { PREMIUM_PREPARED_CONNECTORS } from '@/lib/billing/freePlatformService';
import { OFFICE_MODULE_KEY } from './constants';

export type ModuleActivityStatus = 'Aktiv' | 'Verfügbar' | 'In Vorbereitung' | 'Gesperrt';
export type ModuleTypeLabel = 'Basismodul' | 'Fachmodul' | 'Erweiterung';
export type ModuleCostLabel = 'Kostenlos enthalten' | 'Kostenlos aktivierbar' | 'Noch nicht buchbar';

export type ModuleStatusChip = {
  label: string;
  variant: 'green' | 'cyan' | 'orange' | 'muted' | 'red';
};

export const MODULE_CARD_DESCRIPTIONS: Record<ProductKey, string> = {
  office: 'Verwaltung, Klient:innen, Mitarbeitende, Dokumente und Organisation',
  assist: 'Alltagsbegleitung, Einsatzplanung, Durchführung und Leistungsnachweise',
  pflege: 'Ambulante Pflegeprozesse, Dokumentation und Leistungsplanung',
  stationaer: 'Bewohnerverwaltung, stationäre Abläufe und Dokumentation',
  beratung: 'Pflegeberatung, Beratungsdokumentation und Fallmanagement',
  akademie: 'Schulungen, Kurse und Wissensverwaltung',
};

export function resolveModuleActivityStatus(module: EffectiveModuleAccess): ModuleActivityStatus {
  if (module.billingStatus === 'admin_disabled') return 'Gesperrt';
  if (module.billingStatus === 'premium_prepared') return 'In Vorbereitung';
  if (module.isEffective) return 'Aktiv';
  return 'Verfügbar';
}

export function resolveModuleTypeLabel(productKey: ProductKey): ModuleTypeLabel {
  if (productKey === OFFICE_MODULE_KEY) return 'Basismodul';
  return 'Fachmodul';
}

export function resolveModuleCostLabel(module: EffectiveModuleAccess): ModuleCostLabel {
  if (module.billingStatus === 'premium_prepared') return 'Noch nicht buchbar';
  if (module.productKey === OFFICE_MODULE_KEY || module.accessSource === 'included_base') {
    return 'Kostenlos enthalten';
  }
  if (!module.isEffective) return 'Kostenlos aktivierbar';
  return 'Kostenlos enthalten';
}

function chipVariantForActivity(status: ModuleActivityStatus): ModuleStatusChip['variant'] {
  switch (status) {
    case 'Aktiv':
      return 'green';
    case 'Verfügbar':
      return 'cyan';
    case 'In Vorbereitung':
      return 'orange';
    case 'Gesperrt':
      return 'red';
    default:
      return 'muted';
  }
}

function chipVariantForType(type: ModuleTypeLabel): ModuleStatusChip['variant'] {
  return type === 'Basismodul' ? 'orange' : 'muted';
}

function chipVariantForCost(cost: ModuleCostLabel): ModuleStatusChip['variant'] {
  if (cost === 'Noch nicht buchbar') return 'orange';
  if (cost === 'Kostenlos aktivierbar') return 'cyan';
  return 'muted';
}

/** Max. drei Chips: Aktivität, Typ, Kosten. */
export function buildModuleStatusChips(module: EffectiveModuleAccess): ModuleStatusChip[] {
  const activity = resolveModuleActivityStatus(module);
  const type = resolveModuleTypeLabel(module.productKey);
  const cost = resolveModuleCostLabel(module);

  return [
    { label: activity, variant: chipVariantForActivity(activity) },
    { label: type, variant: chipVariantForType(type) },
    { label: cost, variant: chipVariantForCost(cost) },
  ];
}

export function buildModuleInfoBody(productKey: ProductKey): string {
  const name = PRODUCT_LABELS[productKey];
  const description = MODULE_CARD_DESCRIPTIONS[productKey];
  return `${name} — ${description}`;
}

export function countPreparedExtensions(): number {
  return PREMIUM_PREPARED_CONNECTORS.length;
}
