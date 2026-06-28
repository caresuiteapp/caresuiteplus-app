// CareSuite+ — Google Distance Matrix proxy (server-side API key)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, jsonResponse } from '../_shared/http.ts';

type TransportMode = 'car' | 'transit' | 'bicycle' | 'escooter' | 'walking';
type GoogleTravelMode = 'driving' | 'transit' | 'bicycling' | 'walking';

const ESCOOTER_WALKING_MAX_KM = 3;

function mapTransportModeToGoogle(
  mode: TransportMode,
  distanceHintKm?: number | null,
): { googleMode: GoogleTravelMode; note?: string } {
  switch (mode) {
    case 'car':
      return { googleMode: 'driving' };
    case 'transit':
      return { googleMode: 'transit' };
    case 'bicycle':
      return { googleMode: 'bicycling' };
    case 'walking':
      return { googleMode: 'walking' };
    case 'escooter':
      if (distanceHintKm != null && distanceHintKm <= ESCOOTER_WALKING_MAX_KM) {
        return {
          googleMode: 'walking',
          note: 'E-Scooter: Kurzstrecke als Fußweg geschätzt (kein Google-Modus).',
        };
      }
      return {
        googleMode: 'bicycling',
        note: 'E-Scooter: als Radstrecke geschätzt (kein Google-Modus).',
      };
  }
}

type RequestBody = {
  tenantId?: string;
  origin?: string;
  destination?: string;
  transportMode?: TransportMode;
};

type DistanceMatrixResponse = {
  status: string;
  rows?: Array<{
    elements?: Array<{
      status: string;
      duration?: { value: number };
      distance?: { value: number };
    }>;
  }>;
  error_message?: string;
};

async function queryDistanceMatrix(
  origin: string,
  destination: string,
  googleMode: GoogleTravelMode,
  apiKey: string,
): Promise<{ durationMinutes: number | null; distanceMeters: number | null; status: string }> {
  const params = new URLSearchParams({
    origins: origin,
    destinations: destination,
    mode: googleMode,
    language: 'de',
    key: apiKey,
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`,
  );
  const payload = (await response.json()) as DistanceMatrixResponse;

  if (payload.status !== 'OK') {
    return { durationMinutes: null, distanceMeters: null, status: payload.status };
  }

  const element = payload.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK') {
    return { durationMinutes: null, distanceMeters: null, status: element?.status ?? 'NO_ROUTE' };
  }

  return {
    durationMinutes:
      element.duration?.value != null ? Math.max(1, Math.round(element.duration.value / 60)) : null,
    distanceMeters: element.distance?.value ?? null,
    status: 'OK',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  }

  try {
    const body = (await req.json()) as RequestBody;
    const origin = body.origin?.trim();
    const destination = body.destination?.trim();
    const transportMode = body.transportMode ?? 'car';

    if (!origin || !destination) {
      return jsonResponse({ ok: false, error: 'origin und destination erforderlich.' }, 400);
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim();
    if (!apiKey) {
      return jsonResponse({
        ok: true,
        durationMinutes: null,
        distanceMeters: null,
        googleMode: mapTransportModeToGoogle(transportMode).googleMode,
        note: 'Google Maps API-Schlüssel nicht konfiguriert.',
        source: 'unavailable',
      });
    }

    const mapped = mapTransportModeToGoogle(transportMode);
    let result = await queryDistanceMatrix(origin, destination, mapped.googleMode, apiKey);
    let googleMode = mapped.googleMode;
    let note = mapped.note ?? null;

    if (result.status !== 'OK') {
      return jsonResponse({
        ok: true,
        durationMinutes: null,
        distanceMeters: null,
        googleMode,
        note: `Route: ${result.status}`,
        source: 'unavailable',
      });
    }

    if (transportMode === 'escooter' && result.distanceMeters != null) {
      const refined = mapTransportModeToGoogle('escooter', result.distanceMeters / 1000);
      if (refined.googleMode !== mapped.googleMode) {
        const retry = await queryDistanceMatrix(origin, destination, refined.googleMode, apiKey);
        if (retry.status === 'OK') {
          result = retry;
          googleMode = refined.googleMode;
          note = refined.note ?? note;
        }
      }
    }

    return jsonResponse({
      ok: true,
      durationMinutes: result.durationMinutes,
      distanceMeters: result.distanceMeters,
      googleMode,
      note,
      source: 'google',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
