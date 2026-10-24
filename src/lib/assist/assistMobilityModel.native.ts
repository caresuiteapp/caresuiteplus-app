// Generated native presentation from src/lib/assist/assistMobilityModel.web.ts. Update through scripts/port-native-workspaces.mjs.
/** Web journal projection. Stored values remain authoritative; missing values stay unknown. */
export type MobilityRow = Record<string, unknown>;
export type AssistMobilityTrip = {
    id: string;
    source: 'logbook' | 'legacy';
    tenantId: string;
    employeeId: string | null;
    employeeName: string;
    clientId: string | null;
    clientName: string | null;
    vehicleId: string | null;
    vehicleLabel: string;
    purpose: string;
    routeType: string;
    routeTypeLabel: string;
    status: string;
    statusLabel: string;
    needsReview: boolean;
    startedAt: string;
    endedAt: string | null;
    startAddress: string | null;
    endAddress: string | null;
    distanceKm: number | null;
    durationMinutes: number | null;
    distanceSourceLabel: string;
    notes: string | null;
    assignmentId: string | null;
    detailHref: string | null;
    updatedAt: string | null;
};
export type AssistMobilityJournal = {
    month: string;
    rows: AssistMobilityTrip[];
    employees: {
        id: string;
        name: string;
    }[];
    warnings: string[];
    generatedAt: string;
};
export type MobilityPosition = {
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    capturedAt: string;
};
export type AssistMobilityTrackingRow = {
    id: string;
    visitId: string;
    employeeId: string | null;
    employeeName: string;
    clientName: string | null;
    title: string;
    statusLabel: string;
    trackingState: 'live' | 'stale' | 'waiting' | 'consent_missing' | 'inactive' | 'invalid';
    trackingLabel: string;
    position: MobilityPosition | null;
    lastSignalAt: string | null;
    plannedStartAt: string;
    plannedEndAt: string;
    detailHref: string;
};
export type AssistMobilityTracking = {
    rows: AssistMobilityTrackingRow[];
    generatedAt: string;
    warnings: string[];
};
export const mobilityText = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
export function mobilityNumber(value: unknown): number | null {
    if (value == null || value === '' || typeof value === 'boolean')
        return null;
    const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    return Number.isFinite(result) && result >= 0 ? result : null;
}
export function mobilityBerlinDate(now: Date = new Date()): string {
    if (!Number.isFinite(now.getTime()))
        return '';
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = (part: string) => parts.find(item => item.type === part)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
}
export function mobilityBerlinMonth(now: Date = new Date()): string { return mobilityBerlinDate(now).slice(0, 7); }
export function validMobilityMonth(month: string): boolean { return /^(19|[2-9]\d)\d{2}-(0[1-9]|1[0-2])$/.test(month) && !month.startsWith('9999'); }
export function shiftMobilityMonth(month: string, delta: number): string {
    if (!validMobilityMonth(month) || !Number.isInteger(delta))
        return month;
    const date = new Date(`${month}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + delta);
    const next = date.toISOString().slice(0, 7);
    return validMobilityMonth(next) ? next : month;
}
export function mobilityMonthLabel(month: string): string {
    return validMobilityMonth(month) ? new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00Z`)) : 'Ungültiger Monat';
}
export function mobilityMonthRange(month: string): {
    start: string;
    end: string;
} | null {
    if (!validMobilityMonth(month))
        return null;
    const midnight = (value: string) => {
        const utc = new Date(`${value}-01T00:00:00Z`);
        const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(utc));
        return new Date(utc.getTime() - hour * 3600000).toISOString();
    };
    return { start: midnight(month), end: midnight(shiftMobilityMonth(month, 1)) };
}
const STATUS_LABELS: Record<string, string> = { recording: 'Aufzeichnung läuft', confirmation_required: 'Kilometer bestätigen', review_required: 'Prüfung erforderlich', completed: 'Abgeschlossen', corrected: 'Korrigiert', confirmed: 'Bestätigt', cancelled: 'Storniert' };
const ROUTE_LABELS: Record<string, string> = { home_to_office: 'Zuhause zum Büro', office_to_home: 'Büro nach Hause', home_to_client: 'Anfahrt zum Einsatz', client_to_home: 'Heimfahrt', office_to_client: 'Büro zum Einsatz', client_to_office: 'Einsatz zum Büro', with_client: 'Fahrt mit Klient:in', private_non_business: 'Privatfahrt', commute_home_to_first: 'Anfahrt zum ersten Einsatz', between_assignments: 'Zwischen Einsätzen', commute_last_to_home: 'Heimfahrt', office_to_assignment: 'Büro zum Einsatz', assignment_to_office: 'Einsatz zum Büro', business_trip: 'Dienstfahrt', private_trip: 'Privatfahrt', home_to_first_client: 'Anfahrt zum ersten Einsatz', client_to_client: 'Zwischen Einsätzen', last_client_to_home: 'Heimfahrt', other_business: 'Dienstfahrt', private: 'Privatfahrt' };
function person(row: MobilityRow | undefined): string | null { return row ? mobilityText(row.full_name) ?? mobilityText([row.first_name, row.last_name].filter(Boolean).join(' ')) : null; }
export function mapMobilityTrip(row: MobilityRow, source: 'logbook' | 'legacy', context: {
    employees?: MobilityRow[];
    clients?: MobilityRow[];
    vehicles?: MobilityRow[];
} = {}): AssistMobilityTrip {
    const employeeId = mobilityText(row.employee_id);
    const clientId = mobilityText(row.client_id);
    const vehicleId = mobilityText(row.vehicle_id);
    const tenantId = mobilityText(row.tenant_id) ?? '';
    const id = mobilityText(row.id) ?? '';
    const scoped = (rows: MobilityRow[] | undefined, key: string | null) => rows?.find(item => item.id === key && item.tenant_id === tenantId);
    const candidateVehicle = scoped(context.vehicles, vehicleId);
    const vehicle = candidateVehicle?.employee_id === employeeId ? candidateVehicle : undefined;
    const statusInput = mobilityText(row.status) ?? '';
    const status = source === 'legacy' ? (({ abgeschlossen: 'completed', beendet: 'completed', storniert: 'cancelled', abgesagt: 'cancelled', unterwegs: 'recording', offen: 'recording', laufend: 'recording' } as Record<string, string>)[statusInput] ?? statusInput) : statusInput;
    const startedAt = mobilityText(row.started_at) ?? '';
    const endedAt = mobilityText(row.ended_at);
    const durationMs = endedAt ? Date.parse(endedAt) - Date.parse(startedAt) : NaN;
    const routeType = mobilityText(source === 'logbook' ? row.route_type : row.travel_type) ?? '';
    const sourceKey = mobilityText(row.distance_source);
    return { id, source, tenantId, employeeId, employeeName: person(scoped(context.employees, employeeId)) ?? mobilityText(row.employee_name) ?? 'Name nicht verfügbar',
        clientId, clientName: person(scoped(context.clients, clientId)), vehicleId,
        vehicleLabel: mobilityText(vehicle?.plate) ?? mobilityText(row.vehicle_label) ?? 'Fahrzeug nicht hinterlegt',
        purpose: (source === 'legacy' ? ({ einsatz: 'Einsatzfahrt', dienstfahrt: 'Dienstfahrt', material: 'Materialtransport', sonstiges: 'Weitere Fahrt' } as Record<string, string>)[String(row.purpose)] : null) ?? mobilityText(row.purpose) ?? mobilityText(row.title) ?? 'Fahrt ohne Zweckangabe', routeType, routeTypeLabel: ROUTE_LABELS[routeType] ?? 'Weitere Fahrt',
        status, statusLabel: STATUS_LABELS[status] ?? 'Status unklar', needsReview: ['review_required', 'confirmation_required'].includes(status), startedAt, endedAt,
        startAddress: mobilityText(row.start_address), endAddress: mobilityText(row.end_address), distanceKm: mobilityNumber(source === 'logbook' ? row.distance_final_km : row.distance_km),
        durationMinutes: Number.isFinite(durationMs) && durationMs >= 0 ? durationMs / 60000 : null,
        distanceSourceLabel: source === 'legacy' ? 'Bisheriges Fahrtenbuch' : (({ gps: 'GPS-Aufzeichnung', google_fallback: 'Berechnete Ersatzstrecke', osm_fallback: 'Berechnete Ersatzstrecke', manual: 'Manuell erfasst', office_corrected: 'Durch Verwaltung korrigiert' } as Record<string, string>)[sourceKey ?? ''] ?? 'Herkunft nicht hinterlegt'),
        notes: mobilityText(row.notes), assignmentId: mobilityText(row.assignment_id), updatedAt: mobilityText(row.updated_at),
        detailHref: id ? `/assist/fahrten/${encodeURIComponent(id)}?source=${source}` : null };
}
export function buildMobilityJournal(input: {
    tenantId: string;
    month: string;
    canonical: MobilityRow[];
    legacy: MobilityRow[];
    employees?: MobilityRow[];
    clients?: MobilityRow[];
    vehicles?: MobilityRow[];
    warnings?: string[];
    now?: Date;
}): AssistMobilityJournal {
    const rows: AssistMobilityTrip[] = [];
    const seen = new Set<string>();
    for (const source of ['logbook', 'legacy'] as const)
        for (const row of source === 'logbook' ? input.canonical : input.legacy) {
            const id = mobilityText(row.id);
            if (!id || row.tenant_id !== input.tenantId || seen.has(id))
                continue;
            if (mobilityBerlinMonth(new Date(String(row.started_at))) !== input.month)
                continue;
            seen.add(id);
            rows.push(mapMobilityTrip(row, source, input));
        }
    rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt) || a.id.localeCompare(b.id));
    const employees = [...new Map(rows.filter(row => row.employeeId).map(row => [row.employeeId!, { id: row.employeeId!, name: row.employeeName }])).values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return { month: input.month, rows, employees, warnings: input.warnings ?? [], generatedAt: (input.now ?? new Date()).toISOString() };
}
export function filterMobilityTrips(rows: AssistMobilityTrip[], filters: {
    search?: string;
    employeeId?: string;
    status?: 'all' | 'review' | 'recording' | 'completed' | 'cancelled';
}): AssistMobilityTrip[] {
    const words = (filters.search ?? '').trim().toLocaleLowerCase('de-DE').split(/\s+/).filter(Boolean);
    return rows.filter(row => (!filters.employeeId || filters.employeeId === 'all' || row.employeeId === filters.employeeId)
        && (!filters.status || filters.status === 'all' || (filters.status === 'review' ? row.needsReview : filters.status === 'completed' ? ['completed', 'corrected', 'confirmed'].includes(row.status) : row.status === filters.status))
        && words.every(word => [row.employeeName, row.clientName, row.purpose, row.startAddress, row.endAddress, row.vehicleLabel, row.statusLabel].filter(Boolean).join(' ').toLocaleLowerCase('de-DE').includes(word)));
}
export function mobilityTrackingPosition(input: {
    active: boolean;
    visible: boolean;
    consent: boolean;
    point: MobilityRow | null;
    now?: Date;
}): Pick<AssistMobilityTrackingRow, 'trackingState' | 'trackingLabel' | 'position' | 'lastSignalAt'> {
    const empty = { position: null, lastSignalAt: null };
    if (!input.active || !input.visible)
        return { ...empty, trackingState: 'inactive', trackingLabel: 'Keine aktive Standortfreigabe' };
    if (!input.consent)
        return { ...empty, trackingState: 'consent_missing', trackingLabel: 'Standort nicht freigegeben' };
    if (!input.point)
        return { ...empty, trackingState: 'waiting', trackingLabel: 'Wartet auf GPS-Signal' };
    const latitude = input.point.latitude;
    const longitude = input.point.longitude;
    const capturedAt = mobilityText(input.point.recorded_at);
    const accuracyRaw = input.point.accuracy_meters;
    const accuracyMeters = accuracyRaw == null ? null : mobilityNumber(accuracyRaw);
    const age = (input.now ?? new Date()).getTime() - Date.parse(capturedAt ?? '');
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (accuracyRaw != null && (accuracyMeters == null || accuracyMeters > 120)) || !Number.isFinite(age) || age < 0) {
        return { ...empty, trackingState: 'invalid', trackingLabel: 'GPS-Signal nicht verwendbar', lastSignalAt: capturedAt };
    }
    if (age > 150000)
        return { ...empty, trackingState: 'stale', trackingLabel: 'GPS-Signal veraltet', lastSignalAt: capturedAt };
    return { trackingState: 'live', trackingLabel: 'GPS aktuell', position: { latitude, longitude, accuracyMeters, capturedAt: capturedAt! }, lastSignalAt: capturedAt };
}
