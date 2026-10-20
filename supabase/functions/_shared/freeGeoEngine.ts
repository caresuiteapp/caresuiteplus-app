export type Coordinate = {
    latitude: number;
    longitude: number;
    formattedAddress?: string;
};
export type ProviderRequest = (url: string, provider: 'photon' | 'osrm') => Promise<unknown>;
export function validCoordinate(value: Coordinate): boolean {
    return Number.isFinite(value.latitude) && Number.isFinite(value.longitude) && Math.abs(value.latitude) <= 90 && Math.abs(value.longitude) <= 180;
}
export async function geocodeFree(address: string, request: ProviderRequest): Promise<Coordinate | null> {
    if (!address?.trim() || address.length > 300)
        throw new Error('Bitte eine gültige Adresse angeben.');
    const numeric = address.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (numeric) {
        const c = { latitude: Number(numeric[1]), longitude: Number(numeric[2]) };
        if (!validCoordinate(c))
            throw new Error('Ungültige Koordinaten.');
        return c;
    }
    const params = new URLSearchParams({ q: address.trim(), lang: 'de', limit: '5', bbox: '5.866343,47.270111,15.041932,55.058347' });
    const response = await request(`https://photon.komoot.io/api/?${params}`, 'photon') as {
        features?: {
            geometry?: {
                coordinates?: number[];
            };
            properties?: Record<string, string>;
        }[];
    };
    const postcode = address.match(/\b\d{5}\b/)?.[0];
    const house = address.split(',')[0].trim().match(/\s(\d+\s?[a-z]?)$/i)?.[1]?.replace(/\s/g, '').toLowerCase();
    const matches = (response.features ?? []).flatMap(feature => {
        const p = feature.properties ?? {}, xy = feature.geometry?.coordinates;
        if (!xy || (p.countrycode && p.countrycode.toLowerCase() !== 'de') || (postcode && p.postcode !== postcode) || (house && p.housenumber?.replace(/\s/g, '').toLowerCase() !== house))
            return [];
        const coordinate = { latitude: xy[1], longitude: xy[0], formattedAddress: [[p.street, p.housenumber].filter(Boolean).join(' '), [p.postcode, p.city ?? p.town ?? p.village].filter(Boolean).join(' ')].filter(Boolean).join(', ') };
        return validCoordinate(coordinate) ? [coordinate] : [];
    });
    if (matches.some(c => Math.abs(c.latitude - matches[0].latitude) > 0.001 || Math.abs(c.longitude - matches[0].longitude) > 0.001))
        throw new Error('Adresse nicht eindeutig. Bitte Straße, Hausnummer und Postleitzahl prüfen.');
    return matches[0] ?? null;
}
export async function computeFreeRoute(input: {
    origin: string;
    destination: string;
    transportMode: string;
    includeRouteGeometry?: boolean;
}, request: ProviderRequest) {
    const mode = input.transportMode;
    if (!['car', 'transit', 'bicycle', 'escooter', 'walking'].includes(mode))
        throw new Error('Ungültige Fortbewegungsart.');
    if (mode === 'transit')
        return { source: 'unavailable', durationMinutes: null, distanceMeters: null, googleMode: 'transit', note: 'ÖPNV-Verbindungen sind im kostenlosen Routendienst nicht verfügbar. Bitte Fahrplanauskunft verwenden.' };
    const origin = await geocodeFree(input.origin, request), destination = await geocodeFree(input.destination, request);
    if (!origin || !destination)
        return { source: 'unavailable', durationMinutes: null, distanceMeters: null, googleMode: null, note: 'Start- oder Zieladresse konnte nicht eindeutig gefunden werden.' };
    const profile = mode === 'car' ? 'car' : mode === 'walking' ? 'foot' : 'bike';
    const url = `https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=${input.includeRouteGeometry ? 'full' : 'false'}&geometries=polyline&steps=false`;
    const data = await request(url, 'osrm') as {
        code?: string;
        routes?: {
            duration?: number;
            distance?: number;
            geometry?: string;
        }[];
    };
    const route = data.routes?.[0];
    if (data.code !== 'Ok' || !route || !Number.isFinite(route.duration) || !Number.isFinite(route.distance) || route.duration! < 0 || route.distance! < 0)
        throw new Error('Keine befahrbare Route gefunden.');
    return { source: 'osm', durationMinutes: Math.max(1, Math.round(route.duration! / 60)), distanceMeters: route.distance, googleMode: mode === 'car' ? 'driving' : mode === 'walking' ? 'walking' : 'bicycling', encodedPolyline: input.includeRouteGeometry ? route.geometry ?? null : null, originCoordinate: origin, destinationCoordinate: destination, note: mode === 'escooter' ? 'Fahrradroute als E-Scooter-Schätzung; lokale Fahrverbote prüfen.' : 'Berechnete Route ohne Live-Verkehr. Keine gemessenen GPS-Kilometer.', attribution: '© OpenStreetMap-Mitwirkende · Routing: FOSSGIS' };
}
