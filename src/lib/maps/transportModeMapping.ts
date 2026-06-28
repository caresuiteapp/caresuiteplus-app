import type {
  EmployeeTransportMode,
  GoogleTravelMode,
} from '@/types/modules/employeeMobility';

export type MappedGoogleTravelMode = {
  googleMode: GoogleTravelMode;
  /** Shown when we approximate (e.g. E-Scooter has no Google mode). */
  note?: string;
};

/** E-Scooter distance threshold (km) — walking below, bicycling at/above. */
export const ESCOOTER_WALKING_MAX_KM = 3;

/**
 * Maps CareSuite transport modes to Google Distance Matrix / Directions modes.
 *
 * E-Scooter: Google has no dedicated mode. We use `walking` for short distances
 * (≤ 3 km) and `bicycling` otherwise — documented in docs/spec/employee-mobility-google-maps.md.
 */
export function mapTransportModeToGoogle(
  mode: EmployeeTransportMode,
  distanceHintKm?: number | null,
): MappedGoogleTravelMode {
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

export function formatTravelTimeLabel(
  transportMode: EmployeeTransportMode,
  minutes: number | null | undefined,
): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const icon =
    transportMode === 'car'
      ? '🚗'
      : transportMode === 'transit'
        ? '🚇'
        : transportMode === 'bicycle'
          ? '🚲'
          : transportMode === 'escooter'
            ? '🛴'
            : '🚶';
  return `${icon} ${Math.round(minutes)} Min.`;
}
