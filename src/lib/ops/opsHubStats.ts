import { OPS_HUB_MODULES } from './opsHubModules';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type OpsHubKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildOpsHubKpis(mode: ColorMode = 'dark'): OpsHubKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const moduleCount = OPS_HUB_MODULES.length;
  const complianceModules = OPS_HUB_MODULES.filter(
    (module) => module.href.includes('security') || module.href.includes('release'),
  ).length;

  return [
    {
      id: 'modules',
      label: 'Ops-Module',
      value: String(moduleCount),
      subValue: 'Navigation',
      icon: '⚙️',
      accentColor: colors.cyan,
    },
    {
      id: 'compliance',
      label: 'Compliance',
      value: String(complianceModules),
      subValue: 'Release · Security',
      icon: '🛡️',
      accentColor: colors.warning,
    },
    {
      id: 'pilot',
      label: 'Pilot',
      value: '1',
      subValue: 'Readiness rm-001',
      icon: '🧪',
      accentColor: colors.success,
    },
  ];
}
