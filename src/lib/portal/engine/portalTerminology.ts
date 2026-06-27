import type { PortalModuleKey, PortalTerminology } from '@/lib/portal/types';
import { PORTAL_MODULE_LABELS } from './portalModuleKeys';

const TERMINOLOGY_BY_MODULE: Record<PortalModuleKey, PortalTerminology> = {
  assist: {
    greetingLabel: 'Willkommen in Ihrem Assist-Portal',
    appointmentLabel: 'Einsatz',
    appointmentLabelPlural: 'Einsätze',
    personLabel: 'Klient:in',
    careTeamLabel: 'Assist-Team',
    moduleLabel: 'Assist',
  },
  pflege: {
    greetingLabel: 'Willkommen in Ihrem Pflege-Portal',
    appointmentLabel: 'Einsatz',
    appointmentLabelPlural: 'Einsätze',
    personLabel: 'Klient:in',
    careTeamLabel: 'Pflegeteam',
    moduleLabel: 'Pflege',
  },
  stationaer: {
    greetingLabel: 'Willkommen in Ihrem Bewohnerportal',
    appointmentLabel: 'Bewohnertermin',
    appointmentLabelPlural: 'Bewohnertermine',
    personLabel: 'Bewohner:in',
    careTeamLabel: 'Pflege- und Betreuungsteam',
    moduleLabel: 'Stationär',
  },
  beratung: {
    greetingLabel: 'Willkommen in Ihrem Beratungsportal',
    appointmentLabel: 'Beratungstermin',
    appointmentLabelPlural: 'Beratungstermine',
    personLabel: 'Klient:in',
    careTeamLabel: 'Beratungsteam',
    moduleLabel: 'Beratung',
  },
};

const DEFAULT_TERMINOLOGY: PortalTerminology = {
  greetingLabel: 'Willkommen in Ihrem Klient:innenportal',
  appointmentLabel: 'Einsatz',
  appointmentLabelPlural: 'Einsätze',
  personLabel: 'Klient:in',
  careTeamLabel: 'Betreuungsteam',
  moduleLabel: 'Klient:innenportal',
};

export function resolvePortalTerminology(
  primaryModule: PortalModuleKey | null,
): PortalTerminology {
  if (!primaryModule) return DEFAULT_TERMINOLOGY;
  return TERMINOLOGY_BY_MODULE[primaryModule];
}

export function resolveModuleTerminology(moduleKey: PortalModuleKey): PortalTerminology {
  return TERMINOLOGY_BY_MODULE[moduleKey];
}

export function resolveCombinedModuleLabel(modules: PortalModuleKey[]): string {
  if (modules.length === 0) return 'Klient:innenportal';
  if (modules.length === 1) return PORTAL_MODULE_LABELS[modules[0]];
  return modules.map((m) => PORTAL_MODULE_LABELS[m]).join(' · ');
}
