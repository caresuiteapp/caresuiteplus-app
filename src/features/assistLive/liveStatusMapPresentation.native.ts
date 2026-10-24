// Generated native presentation from src/features/assistLive/liveStatusMapPresentation.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { AssistLiveMonitoringRow } from './getAssistLiveMonitoring';
import { isFreshLivePosition } from './getAssistLiveMonitoringWorkspace';
import type { AssistLiveRoutePoint, AssistMapPosition } from '@/lib/assist/assistMapProvider';
import type { EmployeePortalGoogleRouteReference } from '@/types/modules/employeePortalTracking';
export type LiveMapSignal = {
    label: string;
    detail: string;
    tone: 'live' | 'warning' | 'quiet';
};
function validCoordinates(point: {
    latitude: number;
    longitude: number;
}): boolean {
    return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}
/** Historical positions remain useful, but untrusted or future fixes are never plotted. */
export function getLiveMapPosition(row: AssistLiveMonitoringRow | null, nowMs: number): AssistMapPosition | null {
    const tracking = row?.tracking;
    const point = tracking?.lastPosition;
    if (!point || !tracking?.consent.granted || !validCoordinates(point))
        return null;
    if (point.accuracyMeters != null && (!Number.isFinite(point.accuracyMeters) || point.accuracyMeters < 0 || point.accuracyMeters > 120))
        return null;
    const capturedMs = new Date(point.capturedAt).getTime();
    if (!Number.isFinite(capturedMs) || capturedMs > nowMs)
        return null;
    return point;
}
export function formatLiveMapAge(iso: string | null | undefined, nowMs: number): string {
    const timestamp = iso ? new Date(iso).getTime() : Number.NaN;
    if (!Number.isFinite(timestamp) || timestamp > nowMs)
        return 'Zeitpunkt nicht bestätigt';
    const seconds = Math.floor((nowMs - timestamp) / 1000);
    if (seconds < 10)
        return 'gerade eben';
    if (seconds < 60)
        return `vor ${seconds} Sek.`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
        return `vor ${minutes} Min.`;
    return `vom ${new Date(timestamp).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} Uhr`;
}
export function getLiveMapSignal(row: AssistLiveMonitoringRow | null, nowMs: number): LiveMapSignal {
    const tracking = row?.tracking;
    if (!row)
        return { label: 'Keine Auswahl', detail: 'Einen Einsatz auswählen, um Standort und Strecke zu sehen.', tone: 'quiet' };
    if (!tracking)
        return { label: 'Keine Standortdaten', detail: 'Für diesen Einsatz wurden noch keine Standortdaten übermittelt.', tone: 'quiet' };
    if (!tracking.consent.granted)
        return { label: 'Keine Standortfreigabe', detail: 'Die Standortfreigabe im Mitarbeiterportal steht aus.', tone: 'quiet' };
    const position = getLiveMapPosition(row, nowMs);
    if (!position) {
        if (tracking.gpsPermission === 'denied')
            return { label: 'GPS blockiert', detail: 'Die Standortberechtigung ist auf dem Mitarbeitendengerät blockiert.', tone: 'warning' };
        if (tracking.lastPosition)
            return { label: 'Position nicht bestätigt', detail: 'Der letzte GPS-Punkt hat ungültige Koordinaten, einen ungültigen Zeitpunkt oder eine zu geringe Genauigkeit.', tone: 'warning' };
        return { label: 'Wartet auf Position', detail: 'Der gewählte Einsatz hat noch keinen bestätigten GPS-Punkt.', tone: 'quiet' };
    }
    if (isFreshLivePosition(row, nowMs))
        return { label: 'GPS live', detail: `Position ${formatLiveMapAge(position.capturedAt, nowMs)}`, tone: 'live' };
    if (!tracking.trackingActive || !tracking.assistVisible)
        return { label: 'Letzte Position', detail: `Aufzeichnung nicht aktiv. Position ${formatLiveMapAge(position.capturedAt, nowMs)}.`, tone: 'quiet' };
    return { label: 'Signal verzögert', detail: `Letzte bestätigte Position ${formatLiveMapAge(position.capturedAt, nowMs)}.`, tone: 'warning' };
}
/** Reject malformed geometry rather than drawing a plausible-looking fallback. */
export function getLivePlannedRoute(reference: EmployeePortalGoogleRouteReference | null | undefined, nowMs: number): AssistLiveRoutePoint[] {
    if (reference?.provider !== 'osm' || reference.source !== 'osm' || !reference.encodedPolyline)
        return [];
    const timestamp = new Date(reference.requestedAt).getTime();
    if (!Number.isFinite(timestamp) || timestamp > nowMs || reference.encodedPolyline.length > 200000)
        return [];
    const encoded = reference.encodedPolyline;
    const result: AssistLiveRoutePoint[] = [];
    let index = 0;
    let latitude = 0;
    let longitude = 0;
    const readValue = (): number | null => {
        let value = 0;
        let shift = 0;
        while (index < encoded.length && shift <= 30) {
            const byte = encoded.charCodeAt(index++) - 63;
            if (byte < 0 || byte > 63)
                return null;
            value |= (byte & 0x1f) << shift;
            if (byte < 0x20)
                return (value & 1) ? ~(value >>> 1) : value >>> 1;
            shift += 5;
        }
        return null;
    };
    while (index < encoded.length) {
        const latDelta = readValue();
        const lonDelta = readValue();
        if (latDelta == null || lonDelta == null)
            return [];
        latitude += latDelta;
        longitude += lonDelta;
        const point = { latitude: latitude / 1e5, longitude: longitude / 1e5, capturedAt: reference.requestedAt, accuracyMeters: null };
        if (!validCoordinates(point))
            return [];
        result.push(point);
    }
    return result.length >= 2 ? result : [];
}
export function formatLiveMapDistance(kilometres: number | null | undefined): string {
    if (kilometres == null || !Number.isFinite(kilometres) || kilometres < 0)
        return '—';
    return `${kilometres.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;
}
export function formatLiveMapDuration(seconds: number | null | undefined): string {
    if (seconds == null || !Number.isFinite(seconds) || seconds < 0)
        return '—';
    const minutes = Math.floor(seconds / 60);
    return minutes >= 60 ? `${Math.floor(minutes / 60)} Std. ${minutes % 60} Min.` : `${minutes} Min.`;
}
