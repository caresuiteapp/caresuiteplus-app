/**
 * Ops hub live readiness.
 * Betriebs-Navigation ist UI-fähig; echte Ops-Orchestrierung (Runbooks, On-Call) bleibt offen.
 */
export function isOpsLiveReady(): boolean {
  return false;
}

export const OPS_PREPARED_MESSAGE =
  'Echte Ops-Orchestrierung (Runbooks, On-Call, Incident-Bridge) ist in Vorbereitung. Der Betrieb-Hub ist derzeit ein Navigations-Einstieg mit Demo-Modulen.';
