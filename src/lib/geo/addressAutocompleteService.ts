/**
 * Adress-Autocomplete für deutsche Adressen.
 *
 * Provider: Photon (Komoot) — OSM-basiert, kostenlos, kein API-Key.
 * API-Dokumentation: https://github.com/komoot/photon#public-api
 * Bitte Anfragen debouncen (≥300 ms) und nur bei Nutzereingabe auslösen.
 *
 * Optional: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY — Google Places Autocomplete
 * (nur wenn gesetzt; schlägt im Browser oft an CORS fehl, daher Photon-Fallback).
 */
import {
  dedupeAddressSuggestions,
  parsePhotonFeature,
  type AddressSuggestion,
  type PhotonFeature,
} from '@/lib/geo/addressParsing';

const PHOTON_API = 'https://photon.komoot.io/api/';
/** Bounding box Deutschland — reduziert Treffer außerhalb DE. */
const GERMANY_BBOX = '5.866343,47.270111,15.041932,55.058347';
const DEFAULT_LIMIT = 8;
const MIN_QUERY_LENGTH = 3;

export type AddressSearchResult =
  | { ok: true; data: AddressSuggestion[] }
  | { ok: false; error: string };

type PhotonResponse = {
  features?: PhotonFeature[];
};

function getGooglePlacesApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim();
  return key || null;
}

async function searchPhoton(query: string, limit: number, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    lang: 'de',
    limit: String(limit),
    bbox: GERMANY_BBOX,
  });

  const response = await fetch(`${PHOTON_API}?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Photon API Fehler (${response.status})`);
  }

  const payload = (await response.json()) as PhotonResponse;
  const suggestions = (payload.features ?? [])
    .map((feature, index) => parsePhotonFeature(feature, index))
    .filter((entry): entry is AddressSuggestion => entry !== null);

  return dedupeAddressSuggestions(suggestions).slice(0, limit);
}

async function searchGooglePlaces(
  query: string,
  limit: number,
  apiKey: string,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({
    input: query,
    key: apiKey,
    language: 'de',
    components: 'country:de',
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
    { method: 'GET', signal },
  );

  if (!response.ok) {
    throw new Error(`Google Places Fehler (${response.status})`);
  }

  const payload = (await response.json()) as {
    status?: string;
    predictions?: Array<{ place_id: string; description: string }>;
  };

  if (payload.status && payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places: ${payload.status}`);
  }

  return (payload.predictions ?? []).slice(0, limit).map((prediction) => ({
    id: `google-${prediction.place_id}`,
    label: prediction.description,
    street: '',
    houseNumber: '',
    zip: '',
    city: '',
  }));
}

/** Sucht Adressvorschläge für eine Nutzereingabe (debounce im UI). */
export async function searchGermanAddresses(
  query: string,
  options?: { limit?: number; signal?: AbortSignal },
): Promise<AddressSearchResult> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return { ok: true, data: [] };
  }

  const limit = options?.limit ?? DEFAULT_LIMIT;
  const signal = options?.signal;
  const googleKey = getGooglePlacesApiKey();

  if (googleKey) {
    try {
      const googleResults = await searchGooglePlaces(trimmed, limit, googleKey, signal);
      const usable = googleResults.filter(
        (entry) => entry.street.trim() || entry.zip.trim() || entry.city.trim(),
      );
      if (usable.length > 0) {
        return { ok: true, data: usable };
      }
    } catch {
      // Browser-CORS oder API-Fehler — Photon als Fallback
    }
  }

  try {
    const data = await searchPhoton(trimmed, limit, signal);
    return { ok: true, data };
  } catch (error) {
    if (signal?.aborted) {
      return { ok: true, data: [] };
    }
    const message = error instanceof Error ? error.message : 'Adresssuche fehlgeschlagen';
    return { ok: false, error: message };
  }
}

export { MIN_QUERY_LENGTH as ADDRESS_SEARCH_MIN_QUERY_LENGTH };
