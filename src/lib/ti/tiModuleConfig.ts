/**
 * TI/KIM module live readiness.
 * Dashboard und Demo-KIM sind UI-fähig; echte TI-Connector-Anbindung bleibt offen.
 */
export function isTILiveReady(): boolean {
  return false;
}

export const TI_PREPARED_MESSAGE =
  'Echte Telematikinfrastruktur-Anbindung ist in Vorbereitung. Dashboard und KIM-Postfach zeigen derzeit Demo-Daten — keine gematik-Produktivverbindung.';
