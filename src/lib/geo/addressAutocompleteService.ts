/**
 * Adress-Autocomplete für deutsche Adressen.
 *
 * Provider: Photon (Komoot) — OSM-basiert, kostenlos, kein API-Key.
 * API-Dokumentation: https://github.com/komoot/photon#public-api
 * Bitte Anfragen debouncen (≥300 ms) und nur bei Nutzereingabe auslösen.
 *
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

async function searchPhoton(query: string, limit: number, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    lang: 'de',
    limit: String(limit),
    bbox: GERMANY_BBOX,
  });

  const controller=new AbortController();
  const cancel=()=>controller.abort(); signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted)controller.abort();
  const timer=setTimeout(cancel,8000);
  let response: Response;
  try { response = await fetch(`${PHOTON_API}?${params.toString()}`, {
    method: 'GET', headers: { Accept: 'application/json' }, signal:controller.signal,
  }); } finally {clearTimeout(timer);signal?.removeEventListener('abort',cancel);}

  if (!response.ok) {
    throw new Error(`Photon API Fehler (${response.status})`);
  }

  const payload = (await response.json()) as PhotonResponse;
  const suggestions = (payload.features ?? [])
    .map((feature, index) => parsePhotonFeature(feature, index))
    .filter((entry): entry is AddressSuggestion => entry !== null);

  return dedupeAddressSuggestions(suggestions).slice(0, limit);
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

  const limit = Math.max(1, Math.min(10, options?.limit ?? DEFAULT_LIMIT));
  const signal = options?.signal;

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
