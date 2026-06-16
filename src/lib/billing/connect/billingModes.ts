import type { ConnectBillingMode } from '@/types/connect/billing';

export type BillingModeDefinition = {
  key: ConnectBillingMode;
  allowsDtaPreparation: boolean;
  allowsDirectBilling: boolean;
  requiresBillingCenter: boolean;
  productive: boolean;
  description: string;
};

export const BILLING_MODE_DEFINITIONS: BillingModeDefinition[] = [
  {
    key: 'selbst_abrechnen',
    allowsDtaPreparation: true,
    allowsDirectBilling: false,
    requiresBillingCenter: false,
    productive: false,
    description: 'Vorbereitung zur Eigenabrechnung — kein produktiver DTA-Versand.',
  },
  {
    key: 'ueber_abrechnungszentrum',
    allowsDtaPreparation: true,
    allowsDirectBilling: false,
    requiresBillingCenter: true,
    productive: false,
    description: 'Export an Abrechnungszentrum vorbereiten — API-Anbindung folgt später.',
  },
  {
    key: 'leistungsnachweise_export',
    allowsDtaPreparation: false,
    allowsDirectBilling: false,
    requiresBillingCenter: false,
    productive: false,
    description: 'Nur Leistungsnachweise als Exportpaket — keine Abrechnungseinreichung.',
  },
  {
    key: 'rechnung_dta_nachweise_vorbereiten',
    allowsDtaPreparation: true,
    allowsDirectBilling: false,
    requiresBillingCenter: false,
    productive: false,
    description: 'Rechnung, DTA-Vorbereitung und Nachweise zusammenstellen — nicht als abrechenbar markiert.',
  },
  {
    key: 'direktabrechnung_spaeter',
    allowsDtaPreparation: false,
    allowsDirectBilling: false,
    requiresBillingCenter: false,
    productive: false,
    description: 'Direktabrechnung an Pflegekassen ist derzeit nicht freigeschaltet.',
  },
];

export function getBillingModeDefinition(mode: ConnectBillingMode): BillingModeDefinition {
  return BILLING_MODE_DEFINITIONS.find((entry) => entry.key === mode)!;
}

export function isProductiveBillingMode(_mode: ConnectBillingMode): boolean {
  return false;
}
