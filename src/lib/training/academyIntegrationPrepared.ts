export type AcademyIntegrationProvider = 'scorm' | 'xapi' | 'moodle' | 'ilias';

export type AcademyIntegrationStatus = 'prepared' | 'configured' | 'live';

export type AcademyIntegrationEntry = {
  provider: AcademyIntegrationProvider;
  label: string;
  status: AcademyIntegrationStatus;
  description: string;
  productionClaim: false;
};

export const ACADEMY_INTEGRATION_REGISTRY: AcademyIntegrationEntry[] = [
  {
    provider: 'scorm',
    label: 'SCORM 1.2 / 2004',
    status: 'prepared',
    description: 'Lernpaket-Import vorbereitet — kein Live-Player.',
    productionClaim: false,
  },
  {
    provider: 'xapi',
    label: 'xAPI (Tin Can)',
    status: 'prepared',
    description: 'Lernaktivitäts-Statements vorbereitet — kein LRS-Anbindung.',
    productionClaim: false,
  },
  {
    provider: 'moodle',
    label: 'Moodle',
    status: 'prepared',
    description: 'Kurs-Sync-Schnittstelle vorbereitet — OAuth/Token nicht produktiv.',
    productionClaim: false,
  },
  {
    provider: 'ilias',
    label: 'ILIAS',
    status: 'prepared',
    description: 'Lernobjekt-Referenz vorbereitet — kein SSO.',
    productionClaim: false,
  },
];

export const ACADEMY_INTEGRATION_NOTICE =
  'Akademie-Anbindungen (SCORM, xAPI, Moodle, ILIAS) sind nur vorbereitet — kein Produktionsanspruch.';

export function isAcademyIntegrationLive(_provider: AcademyIntegrationProvider): boolean {
  return false;
}

export function getAcademyIntegration(provider: AcademyIntegrationProvider): AcademyIntegrationEntry | undefined {
  return ACADEMY_INTEGRATION_REGISTRY.find((entry) => entry.provider === provider);
}

export function assertAcademyIntegrationAllowed(provider: AcademyIntegrationProvider): {
  ok: true;
  preparedOnly: true;
} | { ok: false; reason: string } {
  const entry = getAcademyIntegration(provider);
  if (!entry) return { ok: false, reason: 'Unbekannte Akademie-Anbindung.' };
  if (isAcademyIntegrationLive(provider)) {
    return { ok: true, preparedOnly: true };
  }
  return { ok: true, preparedOnly: true };
}
