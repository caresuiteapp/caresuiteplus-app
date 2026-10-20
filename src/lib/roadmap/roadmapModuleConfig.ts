/**
 * Roadmap hub live readiness.
 * Demo-Meilensteine sind UI-fähig; echte Planungs-Sync (Jira/Linear) bleibt offen.
 */
export function isRoadmapLiveReady(): boolean {
  return false;
}

export const ROADMAP_PREPARED_MESSAGE =
  'Echte Roadmap-Synchronisation (Jira/Linear) ist in Vorbereitung. Meilensteine und Launch-Readiness zeigen derzeit Demo-Daten — keine Live-Planungsquelle.';
