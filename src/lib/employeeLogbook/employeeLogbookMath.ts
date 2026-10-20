import type { LogbookPoint } from '@/types/modules/employeeLogbook';

const EARTH_RADIUS_KM = 6371.0088;

export function haversineDistanceKm(a: Pick<LogbookPoint, 'latitude' | 'longitude'>, b: Pick<LogbookPoint, 'latitude' | 'longitude'>): number {
  const rad = Math.PI / 180;
  const lat1 = a.latitude * rad; const lat2 = b.latitude * rad;
  const dLat = (b.latitude - a.latitude) * rad; const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function calculateTrackDistanceKm(points: LogbookPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]; const current = points[index];
    if ((current.accuracy ?? 0) > 150) continue;
    const segment = haversineDistanceKm(previous, current);
    if (segment <= 2) total += segment;
  }
  return Math.round(total * 100) / 100;
}

export function calculateTripFinancials(input: { distanceKm: number; rateCents: number; durationSeconds: number; countsAsWorkTime: boolean }) {
  const distanceKm = Math.max(0, Number.isFinite(input.distanceKm) ? input.distanceKm : 0);
  const rateCents = Math.max(0, Math.round(input.rateCents));
  return {
    mileageAmountCents: Math.round(distanceKm * rateCents),
    worktimeDeductionMinutes: input.countsAsWorkTime ? 0 : Math.max(0, Math.ceil(input.durationSeconds / 60)),
  };
}

export function isApproachRoute(routeType: string): boolean {
  return routeType === 'home_to_client' || routeType === 'client_to_home' || routeType === 'home_to_office' || routeType === 'office_to_home';
}
