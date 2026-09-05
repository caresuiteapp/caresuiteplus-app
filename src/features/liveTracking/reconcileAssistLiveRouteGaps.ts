import { fetchTravelTime } from '@/lib/maps/googleMapsTravelService';
import { lastItem } from '@/lib/runtime/runtimeSafeCollections';

export type AssistRouteGapPoint = {
  latitude: number;
  longitude: number;
  capturedAt: string;
};

export type AssistRouteGapLeg = {
  startedAt: string;
  endedAt: string;
  gapSeconds: number;
  distanceKm: number | null;
  source: 'google' | 'unresolved';
};

export type AssistRouteGapReconciliation = {
  googleGapDistanceKm: number;
  resolvedGapCount: number;
  unresolvedGapCount: number;
  legs: AssistRouteGapLeg[];
};

const MAX_ROAD_GAP_KM = 300;
const MAX_GAPS_PER_ROUTE = 12;

function coordinate(point: AssistRouteGapPoint): string {
  return `${point.latitude.toFixed(7)},${point.longitude.toFixed(7)}`;
}

/**
 * Reconciles only the missing interval between two continuous GPS traces.
 * It never draws or bills a straight line. A distance is accepted exclusively
 * when Google returned an actual driving route for both GPS boundary points.
 */
export async function reconcileAssistLiveRouteGaps(
  tenantId: string,
  segments: AssistRouteGapPoint[][],
): Promise<AssistRouteGapReconciliation> {
  const boundaries = segments
    .slice(0, MAX_GAPS_PER_ROUTE + 1)
    .map((segment, index, all) => {
      if (index === 0) return null;
      const previousSegment = all[index - 1] ?? [];
      const previous = lastItem(previousSegment) ?? null;
      const current = segment[0] ?? null;
      if (!previous || !current) return null;
      const gapSeconds = Math.max(
        0,
        Math.round((new Date(current.capturedAt).getTime() - new Date(previous.capturedAt).getTime()) / 1000),
      );
      return { previous, current, gapSeconds };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  const legs = await Promise.all(boundaries.map(async ({ previous, current, gapSeconds }) => {
    try {
      const route = await fetchTravelTime({
        tenantId,
        origin: coordinate(previous),
        destination: coordinate(current),
        transportMode: 'car',
        includeRouteGeometry: false,
      });
      const distanceKm = route.source === 'google' && route.distanceMeters != null
        ? route.distanceMeters / 1000
        : null;
      const accepted = distanceKm != null && distanceKm >= 0 && distanceKm <= MAX_ROAD_GAP_KM;
      return {
        startedAt: previous.capturedAt,
        endedAt: current.capturedAt,
        gapSeconds,
        distanceKm: accepted ? distanceKm : null,
        source: accepted ? 'google' as const : 'unresolved' as const,
      };
    } catch {
      return {
        startedAt: previous.capturedAt,
        endedAt: current.capturedAt,
        gapSeconds,
        distanceKm: null,
        source: 'unresolved' as const,
      };
    }
  }));

  return {
    googleGapDistanceKm: legs.reduce((sum, leg) => sum + (leg.distanceKm ?? 0), 0),
    resolvedGapCount: legs.filter((leg) => leg.source === 'google').length,
    unresolvedGapCount:
      legs.filter((leg) => leg.source === 'unresolved').length +
      Math.max(0, segments.length - 1 - legs.length),
    legs,
  };
}
