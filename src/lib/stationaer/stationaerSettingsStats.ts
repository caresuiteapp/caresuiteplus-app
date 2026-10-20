import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';
import type { StationaerModuleSettings } from '@/types/modules/stationaer';

export type StationaerSettingsKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildStationaerSettingsKpis(settings: StationaerModuleSettings, mode: ColorMode = 'dark'): StationaerSettingsKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const enabled = Object.values(settings).filter(Boolean).length;
  const total = Object.keys(settings).length;

  return [
    {
      id: 'enabled',
      label: 'Aktiv',
      value: String(enabled),
      subValue: `von ${total} Optionen`,
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'handover',
      label: 'Übergabe Pflicht',
      value: settings.handoverRequired ? 'Ja' : 'Nein',
      subValue: 'Schichtübergabe',
      icon: '📝',
      accentColor: colors.amber,
    },
    {
      id: 'risk',
      label: 'Risikodoku',
      value: settings.riskDocumentation ? 'An' : 'Aus',
      subValue: 'Dokumentation',
      icon: '⚠️',
      accentColor: colors.danger,
    },
  ];
}
