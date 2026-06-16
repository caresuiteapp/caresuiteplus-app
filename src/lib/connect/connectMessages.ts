import type { ConnectIntegration } from '@/types/modules/connect';

export const CONNECT_PREPARED_INTERFACE =
  'CareSuite+ Connect stellt vorbereitete Schnittstellen und Kataloge bereit. Es findet derzeit kein produktiver Datenaustausch mit externen Anbietern statt.';

export const CONNECT_REQUIRES_PROVIDER =
  'Diese Integration erfordert eine mandantenspezifische Anbieter-Konfiguration durch einen Administrator.';

export const CONNECT_NO_DATA_TRANSFER =
  'Ohne freigegebene Anbieter-Konfiguration und Live-Freischaltung werden keine Daten übertragen.';

export const CONNECT_SECRETS_SERVER_SIDE =
  'Zugangsdaten und Tokens werden ausschließlich serverseitig hinterlegt — nicht in der App-Oberfläche.';

export const CONNECT_NOT_CONNECTED_LABEL = 'Nicht angebunden';

export function isConnectLiveReady(): boolean {
  return false;
}

export function isConnectIntegrationExecutable(_integration: ConnectIntegration): boolean {
  return false;
}
