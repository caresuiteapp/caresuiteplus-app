/**
 * Load Google Maps JS API with runtime browser key resolution.
 */
import { getGoogleMapsBrowserKey } from './getGoogleMapsBrowserKey';
import {
  loadGoogleMapsApi,
  type GoogleMapsNamespace,
} from './googleMapsLoader';

export { resetGoogleMapsLoaderForTests } from './googleMapsLoader';
export type { GoogleMapsNamespace } from './googleMapsLoader';

export async function loadGoogleMaps(tenantId?: string | null): Promise<GoogleMapsNamespace> {
  const apiKey = await getGoogleMapsBrowserKey(tenantId);
  if (!apiKey) {
    throw new Error(
      'Google Maps ist nicht konfiguriert. Bitte Administrator kontaktieren (Browser-Schlüssel fehlt).',
    );
  }
  return loadGoogleMapsApi(apiKey);
}
