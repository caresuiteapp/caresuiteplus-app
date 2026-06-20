export type GeoCoordinate = {
  latitude: number;
  longitude: number;
};

export type GeofenceSoftCheckInput = {
  current: GeoCoordinate;
  target: GeoCoordinate | null;
  /** Toleranz in Metern — empfohlen 50–250 m */
  toleranceMeters?: number;
  overrideReason?: string | null;
};

export type GeofenceSoftCheckResult = {
  checked: boolean;
  insideTolerance: boolean;
  distanceMeters: number | null;
  toleranceMeters: number;
  warning: string | null;
  overridden: boolean;
  skippedReason: string | null;
};

const DEFAULT_TOLERANCE_METERS = 150;
const MIN_TOLERANCE_METERS = 50;
const MAX_TOLERANCE_METERS = 250;

export function clampGeofenceToleranceMeters(value: number): number {
  return Math.min(MAX_TOLERANCE_METERS, Math.max(MIN_TOLERANCE_METERS, value));
}

/** Haversine-Distanz in Metern — rein clientseitig, kein Backend. */
export function distanceMetersBetween(a: GeoCoordinate, b: GeoCoordinate): number {
  const earthRadiusM = 6_371_000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * earthRadiusM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Weicher Geofence-Check bei Ankunft — Warnung, kein Hard-Block.
 * Ohne Zielkoordinaten wird geprüft übersprungen (Schema-/Geocoding-Gap).
 */
export function runGeofenceSoftCheck(input: GeofenceSoftCheckInput): GeofenceSoftCheckResult {
  const toleranceMeters = clampGeofenceToleranceMeters(
    input.toleranceMeters ?? DEFAULT_TOLERANCE_METERS,
  );

  if (!input.target) {
    return {
      checked: false,
      insideTolerance: true,
      distanceMeters: null,
      toleranceMeters,
      warning: null,
      overridden: false,
      skippedReason:
        'Keine Zielkoordinaten hinterlegt — Geofence-Prüfung erst mit Adress-Geocoding oder Backend.',
    };
  }

  const distanceMeters = distanceMetersBetween(input.current, input.target);
  const insideTolerance = distanceMeters <= toleranceMeters;
  const override = input.overrideReason?.trim();

  if (insideTolerance) {
    return {
      checked: true,
      insideTolerance: true,
      distanceMeters,
      toleranceMeters,
      warning: null,
      overridden: false,
      skippedReason: null,
    };
  }

  if (override) {
    return {
      checked: true,
      insideTolerance: false,
      distanceMeters,
      toleranceMeters,
      warning: `Außerhalb des Einsatzgebiets (~${Math.round(distanceMeters)} m). Override: ${override}`,
      overridden: true,
      skippedReason: null,
    };
  }

  return {
    checked: true,
    insideTolerance: false,
    distanceMeters,
    toleranceMeters,
    warning: `Sie scheinen ~${Math.round(distanceMeters)} m vom Einsatzort entfernt (Toleranz ${toleranceMeters} m). Ankunft trotzdem möglich — bitte prüfen oder Begründung hinterlegen.`,
    overridden: false,
    skippedReason: null,
  };
}
