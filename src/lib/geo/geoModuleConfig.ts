/**
 * Geo/Routes/GPS live readiness — honest preparedOnly until legal + provider review.
 */
export function isGeoLiveReady(): boolean {
  return false;
}

/** Alias für Assist-GPS — zentral über Geo-Modul. */
export function isGpsTrackingLiveReady(): boolean {
  return isGeoLiveReady();
}

export const GEO_PREPARED_MESSAGE =
  'Karten, Routing und GPS-Ortung sind vorbereitet. Externe Provider und Live-Tracking sind ohne Freigabe blockiert.';

export const GPS_TRACKING_PREPARED_MESSAGE = GEO_PREPARED_MESSAGE;

export const GPS_TRIPS_PREPARED_MESSAGE =
  'Automatische Kilometererfassung per GPS folgt — Fahrten werden derzeit manuell erfasst.';

export const LIVE_TRACKING_WINDOW_MINUTES_BEFORE = 30;
export const LIVE_TRACKING_WINDOW_MINUTES_AFTER = 30;

export const DEFAULT_LOCATION_RETENTION_DAYS = 90;

export const CLIENT_PORTAL_VISIBILITY_BUFFER_MINUTES = 15;

export const GEO_LIVE_WIRING_MIGRATION = '0046_geo_routes_prepared.sql';

export function isGeoLiveWiringPrepared(): boolean {
  return true;
}

export type GeoLiveFlipBlocker = {
  id: string;
  label: string;
  resolved: boolean;
};

export function getGeoLiveFlipBlockers(): GeoLiveFlipBlocker[] {
  return [
    {
      id: 'migration-0046',
      label: `Remote-Migration ${GEO_LIVE_WIRING_MIGRATION} angewendet`,
      resolved: false,
    },
    {
      id: 'legal-basis',
      label: 'Rechtsgrundlage für Live-Tracking dokumentiert und Mitarbeitende informiert',
      resolved: false,
    },
    {
      id: 'provider-config',
      label: 'Mindestens ein Kartenprovider aktiv konfiguriert (external_data_allowed)',
      resolved: false,
    },
    {
      id: 'consent-workflow',
      label: 'Einwilligungs-Workflow für Standortdaten produktiv',
      resolved: false,
    },
    {
      id: 'service-mode-supabase',
      label: 'Geo-Services nutzen Supabase statt Demo-Blocker',
      resolved: false,
    },
  ];
}

export function isWithinLiveTrackingWindow(
  assignmentStartAt: string,
  now: Date = new Date(),
  options?: { minutesBefore?: number; minutesAfter?: number },
): boolean {
  const startMs = new Date(assignmentStartAt).getTime();
  if (Number.isNaN(startMs)) return false;
  const beforeMs = (options?.minutesBefore ?? LIVE_TRACKING_WINDOW_MINUTES_BEFORE) * 60_000;
  const afterMs = (options?.minutesAfter ?? LIVE_TRACKING_WINDOW_MINUTES_AFTER) * 60_000;
  const nowMs = now.getTime();
  return nowMs >= startMs - beforeMs && nowMs <= startMs + afterMs;
}

export function computeRetentionUntil(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function computeClientPortalVisibilityWindow(
  assignmentStartAt: string,
  assignmentEndAt?: string | null,
): { visibleFrom: string; visibleUntil: string } {
  const start = new Date(assignmentStartAt);
  const end = assignmentEndAt ? new Date(assignmentEndAt) : new Date(start.getTime() + 2 * 60 * 60_000);
  const bufferMs = CLIENT_PORTAL_VISIBILITY_BUFFER_MINUTES * 60_000;
  return {
    visibleFrom: new Date(start.getTime() - bufferMs).toISOString(),
    visibleUntil: new Date(end.getTime() + bufferMs).toISOString(),
  };
}
