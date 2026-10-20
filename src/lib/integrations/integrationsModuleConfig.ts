/**
 * Integrations hub live readiness.
 * Provider-Registry und Outbox sind UI-fähig; echte OAuth/Vault-Anbindung bleibt offen.
 */
export function isIntegrationsLiveReady(): boolean {
  return false;
}

export const INTEGRATIONS_PREPARED_MESSAGE =
  'Echte Anbieter-Anbindungen (OAuth, Vault, Webhooks) sind in Vorbereitung. Die Integrationsliste zeigt derzeit Demo-Provider — keine Produktiv-Syncs.';
