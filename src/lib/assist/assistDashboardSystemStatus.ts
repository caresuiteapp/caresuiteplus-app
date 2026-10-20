import { isAssistMapProviderConfigured } from '@/lib/assist/gpsTrackingConfig';

export type AssistDashboardSystemStatusItem = {
  id: string;
  title: string;
  detail: string;
};

/** Compact system hints for Assist dashboard — not dominant setup banners. */
export function buildAssistDashboardSystemStatus(): AssistDashboardSystemStatusItem[] {
  const mapReady = isAssistMapProviderConfigured();

  return [
    {
      id: 'storage',
      title: 'Speicherung aktiv',
      detail: 'Einsätze, Nachweise und Signaturen werden sicher gespeichert.',
    },
    {
      id: 'map-optional',
      title: mapReady ? 'Kartenansicht aktiv' : 'Kartenansicht optional',
      detail: mapReady
        ? 'Live-Standorte werden in der Kartenansicht und als Liste angezeigt.'
        : 'Ohne Kartenansicht wird der Live-Status als Liste angezeigt.',
    },
    {
      id: 'location-scoped',
      title: 'Standort nur einsatzbezogen',
      detail: 'Live-Zeit und Standortstatus werden nur während aktiver Einsätze genutzt.',
    },
  ];
}

export type AssistDashboardCheckpoint = {
  id: string;
  label: string;
  count: number;
  navigationTarget: string;
};

/** Open workflow checkpoints derived from dashboard stats. */
export function buildAssistDashboardCheckpoints(stats: {
  incompleteCount: number;
  openSignatureCount: number;
  openProofReviewCount: number;
  openPortalReleaseCount: number;
}): AssistDashboardCheckpoint[] {
  return [
    {
      id: 'documentation',
      label: 'Dokumentation offen',
      count: stats.incompleteCount,
      navigationTarget: '/assist/durchfuehrung',
    },
    {
      id: 'signature',
      label: 'Signatur ausstehend',
      count: stats.openSignatureCount,
      navigationTarget: '/assist/nachweise',
    },
    {
      id: 'proof-review',
      label: 'Nachweis prüfen',
      count: stats.openProofReviewCount,
      navigationTarget: '/assist/nachweise',
    },
    {
      id: 'portal-release',
      label: 'Portal-Freigabe',
      count: stats.openPortalReleaseCount,
      navigationTarget: '/assist/nachweise',
    },
  ].filter((item) => item.count > 0);
}
