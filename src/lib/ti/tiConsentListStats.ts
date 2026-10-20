import type { TIConsent } from '@/types/modules/ti';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type TIConsentListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildTIConsentListKpis(consents: TIConsent[], mode: ColorMode = 'dark'): TIConsentListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const pending = consents.filter((c) => c.status === 'pending').length;
  const granted = consents.filter((c) => c.status === 'granted').length;
  const revoked = consents.filter((c) => c.status === 'revoked' || c.status === 'expired').length;

  return [
    {
      id: 'total',
      label: 'Einwilligungen',
      value: String(consents.length),
      icon: '📜',
      accentColor: colors.cyan,
    },
    {
      id: 'pending',
      label: 'Ausstehend',
      value: String(pending),
      subValue: pending > 0 ? 'Erteilung erforderlich' : 'Alle bearbeitet',
      icon: '⏳',
      accentColor: pending > 0 ? colors.orange : colors.success,
    },
    {
      id: 'granted',
      label: 'Erteilt',
      value: String(granted),
      subValue: revoked > 0 ? `${revoked} widerrufen/abgelaufen` : undefined,
      icon: '✅',
      accentColor: colors.success,
    },
  ];
}
