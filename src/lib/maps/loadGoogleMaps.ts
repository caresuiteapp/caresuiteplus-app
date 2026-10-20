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
      'Kartenansicht konnte nicht geladen werden. Bitte erneut versuchen.',
    );
  }
  return loadGoogleMapsApi(apiKey);
}
