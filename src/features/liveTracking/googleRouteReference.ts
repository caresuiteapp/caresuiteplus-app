import { mergeTrackingSessionMetadata } from '@/lib/assist/assistTrackingPersistenceService';
import { fetchTravelTime } from '@/lib/maps/googleMapsTravelService';
import type { EmployeePortalGoogleRouteReference } from '@/types/modules/employeePortalTracking';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export const GOOGLE_ROUTE_REFERENCE_METADATA_KEY = 'google_route_reference';

export async function captureGoogleRouteReference(input: {
  tenantId: string;
  sessionId: string;
  employeeId: string;
  origin: { latitude: number; longitude: number };
  destinationAddress: string;
}): Promise<EmployeePortalGoogleRouteReference> {
  const travel = await fetchTravelTime({
    tenantId: input.tenantId,
    origin: `${input.origin.latitude},${input.origin.longitude}`,
    destination: input.destinationAddress,
    transportMode: 'car',
    allowHeuristicFallback: false,
    includeRouteGeometry: true,
  });
  const reference: EmployeePortalGoogleRouteReference = {
    provider: 'google',
    requestedAt: new Date().toISOString(),
    origin: input.origin,
    destinationAddress: input.destinationAddress,
    distanceMeters: travel.distanceMeters,
    durationMinutes: travel.durationMinutes,
    encodedPolyline: travel.encodedPolyline ?? null,
    source: travel.source === 'google' ? 'google' : 'unavailable',
  };
  await mergeTrackingSessionMetadata(input.tenantId, input.sessionId, {
    [GOOGLE_ROUTE_REFERENCE_METADATA_KEY]: reference,
  });
  const supabase = getSupabaseClient();
  if (supabase && reference.source === 'google') {
    await fromUnknownTable(supabase, 'employee_logbook_trips')
      .update({
        google_route_distance_km: reference.distanceMeters != null ? reference.distanceMeters / 1000 : null,
        google_route_duration_minutes: reference.durationMinutes,
        google_route_polyline: reference.encodedPolyline,
        google_route_captured_at: reference.requestedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', input.tenantId)
      .eq('employee_id', input.employeeId)
      .eq('status', 'recording');
  }
  return reference;
}

export function parseGoogleRouteReference(
  metadata: Record<string, unknown> | null | undefined,
): EmployeePortalGoogleRouteReference | null {
  const value = metadata?.[GOOGLE_ROUTE_REFERENCE_METADATA_KEY];
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<EmployeePortalGoogleRouteReference>;
  if (
    candidate.provider !== 'google' ||
    typeof candidate.requestedAt !== 'string' ||
    typeof candidate.destinationAddress !== 'string' ||
    !candidate.origin ||
    typeof candidate.origin.latitude !== 'number' ||
    typeof candidate.origin.longitude !== 'number'
  ) return null;
  return {
    provider: 'google',
    requestedAt: candidate.requestedAt,
    origin: candidate.origin,
    destinationAddress: candidate.destinationAddress,
    distanceMeters: typeof candidate.distanceMeters === 'number' ? candidate.distanceMeters : null,
    durationMinutes: typeof candidate.durationMinutes === 'number' ? candidate.durationMinutes : null,
    encodedPolyline: typeof candidate.encodedPolyline === 'string' ? candidate.encodedPolyline : null,
    source: candidate.source === 'google' ? 'google' : 'unavailable',
  };
}

export function decodeGooglePolyline(encoded: string | null | undefined): {
  latitude: number;
  longitude: number;
}[] {
  if (!encoded) return [];
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index <= encoded.length);
    latitude += (result & 1) ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index <= encoded.length);
    longitude += (result & 1) ? ~(result >> 1) : result >> 1;
    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }
  return points;
}
