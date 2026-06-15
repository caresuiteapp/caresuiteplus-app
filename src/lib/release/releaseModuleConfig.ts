/**
 * Release hub live readiness.
 * Demo-Manifeste und Checklisten sind UI-fähig; echte EAS/Store-Pipelines bleiben offen.
 */
export function isReleaseLiveReady(): boolean {
  return false;
}

export const RELEASE_PREPARED_MESSAGE =
  'Echte Release-Pipelines (EAS Build, Store-Submit, OTA) sind in Vorbereitung. Manifest und Checklisten zeigen derzeit Demo-Daten — keine Produktiv-Deployments.';
