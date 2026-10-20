import type { GoogleMapsNamespace, GoogleMapOptions, GoogleMapInstance, GoogleLatLngBoundsInstance, GoogleMarkerInstance } from './googleMapsLoader';
import { geocodeWithFreeProvider } from './freeGeocoding';
type Coordinate = {
    lat: number;
    lng: number;
};
type Handler = (event?: {
    error?: Error;
}) => void;
type RawMap = {
    easeTo(options: {
        center: number[];
    }): void;
    jumpTo(options: {
        center: number[];
    }): void;
    fitBounds(bounds: number[][], options: {
        padding: number;
        maxZoom: number;
        duration: number;
    }): void;
    on(event: string, handler: Handler): void;
    off(event: string, handler: Handler): void;
    loaded(): boolean;
    resize(): void;
    remove(): void;
    addControl(control: unknown, position?: string): void;
    addSource(id: string, source: unknown): void;
    getSource(id: string): unknown;
    removeSource(id: string): void;
    addLayer(layer: unknown): void;
    getLayer(id: string): unknown;
    removeLayer(id: string): void;
};
type RawMarker = {
    setLngLat(position: number[]): RawMarker;
    addTo(map: RawMap): RawMarker;
    remove(): void;
};
type RawPopup = {
    setHTML(html: string): RawPopup;
    setLngLat(position: number[]): RawPopup;
    addTo(map: RawMap): RawPopup;
    remove(): void;
};
export type FreeMapSDK = {
    Map: new (options: unknown) => RawMap;
    Marker: new (options: unknown) => RawMarker;
    Popup: new (options: unknown) => RawPopup;
    NavigationControl: new (options?: unknown) => unknown;
    FullscreenControl: new () => unknown;
};
const pair = (c: Coordinate) => [c.lng, c.lat];
const valid = (c: Coordinate) => Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180;
let lineId = 0;
/** Small compatibility surface for existing CareSuite screens. No Google SDK or keys. */
export function createFreeMapNamespace(sdk: FreeMapSDK, tenantId?: string | null): GoogleMapsNamespace {
    class Bounds implements GoogleLatLngBoundsInstance {
        points: Coordinate[] = [];
        extend(c: Coordinate) { if (valid(c))
            this.points.push(c); }
    }
    class MapView implements GoogleMapInstance {
        raw: RawMap;
        private resizeObserver?: ResizeObserver;
        constructor(el: HTMLElement, opts: GoogleMapOptions) {
            this.raw = new sdk.Map({ container: el, style: 'https://tiles.openfreemap.org/styles/bright', center: pair(opts.center ?? { lat: 51.5, lng: 7.5 }), zoom: opts.zoom ?? 13, attributionControl: true });
            this.raw.addControl(new sdk.NavigationControl(), 'top-right');
            if (opts.fullscreenControl)
                this.raw.addControl(new sdk.FullscreenControl(), 'top-right');
            if (typeof ResizeObserver !== 'undefined') {
                this.resizeObserver = new ResizeObserver(() => this.raw.resize());
                this.resizeObserver.observe(el);
            }
        }
        setCenter(c: Coordinate) { if (valid(c))
            this.raw.jumpTo({ center: pair(c) }); }
        panTo(c: Coordinate) { if (valid(c))
            this.raw.easeTo({ center: pair(c) }); }
        fitBounds(value: GoogleLatLngBoundsInstance) {
            const p = (value as Bounds).points;
            if (!p?.length)
                return;
            this.raw.fitBounds([[Math.min(...p.map(c => c.lng)), Math.min(...p.map(c => c.lat))], [Math.max(...p.map(c => c.lng)), Math.max(...p.map(c => c.lat))]], { padding: 46, maxZoom: 15, duration: 0 });
        }
        onError(handler: (error: Error) => void) { const listener: Handler = e => handler(e?.error ?? new Error('Kartenansicht konnte nicht geladen werden. GPS-Daten bleiben erhalten.')); this.raw.on('error', listener); return () => this.raw.off('error', listener); }
        dispose() { this.resizeObserver?.disconnect(); this.raw.remove(); }
    }
    class Marker {
        raw: RawMarker;
        position: Coordinate;
        element: HTMLButtonElement;
        constructor(opts: {
            map?: GoogleMapInstance;
            position: Coordinate;
            title?: string;
            icon?: {
                url: string;
            };
        }) {
            this.position = opts.position;
            this.element = document.createElement('button');
            this.element.type = 'button';
            this.element.title = opts.title ?? 'Standort';
            this.element.setAttribute('aria-label', this.element.title);
            this.element.style.cssText = 'width:24px;height:24px;border-radius:50%;border:3px solid white;background:#1478e8;box-shadow:0 0 0 5px #1478e833,0 2px 12px #071a3166;cursor:pointer;padding:0';
            if (opts.icon?.url && /^(data:image\/|https:\/\/)/.test(opts.icon.url)) {
                const image = document.createElement('img');
                image.src = opts.icon.url;
                image.alt = '';
                image.width = 50;
                image.height = 50;
                this.element.style.cssText = 'width:50px;height:50px;background:transparent;border:0;padding:0;cursor:pointer';
                this.element.appendChild(image);
            }
            this.raw = new sdk.Marker({ element: this.element, anchor: 'center' }).setLngLat(pair(opts.position));
            if (opts.map)
                this.setMap(opts.map);
        }
        setPosition(c: Coordinate) { if (valid(c)) {
            this.position = c;
            this.raw.setLngLat(pair(c));
        } }
        setMap(map: GoogleMapInstance | null) { if (map)
            this.raw.addTo((map as MapView).raw);
        else
            this.raw.remove(); }
        addListener(event: string, handler: () => void) { this.element.addEventListener(event, handler); }
    }
    class InfoWindow {
        raw = new sdk.Popup({ closeButton: true, maxWidth: '340px' });
        setContent(html: string) { this.raw.setHTML(html); }
        open(opts: {
            map: GoogleMapInstance;
            anchor?: GoogleMarkerInstance;
        }) { if (opts.anchor)
            this.raw.setLngLat(pair((opts.anchor as Marker).position)); this.raw.addTo((opts.map as MapView).raw); }
        close() { this.raw.remove(); }
    }
    class Polyline {
        id = `caresuite-route-${++lineId}`;
        current: MapView | null = null;
        cleanup?: () => void;
        opts: {
            path: Coordinate[];
            strokeColor?: string;
            strokeOpacity?: number;
            strokeWeight?: number;
            icons?: unknown[];
        };
        constructor(opts: Polyline['opts'] & {
            map?: GoogleMapInstance;
        }) { this.opts = opts; if (opts.map)
            this.setMap(opts.map); }
        setMap(map: GoogleMapInstance | null) {
            this.cleanup?.();
            this.cleanup = undefined;
            if (this.current) {
                const raw = this.current.raw;
                if (raw.getLayer(this.id))
                    raw.removeLayer(this.id);
                if (raw.getSource(this.id))
                    raw.removeSource(this.id);
            }
            this.current = map as MapView | null;
            if (!this.current)
                return;
            const raw = this.current.raw;
            const draw = () => {
                const coordinates = this.opts.path.filter(valid).map(pair);
                if (coordinates.length < 2 || raw.getSource(this.id))
                    return;
                raw.addSource(this.id, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } } });
                raw.addLayer({ id: this.id, type: 'line', source: this.id, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': this.opts.strokeColor ?? '#0B63F3', 'line-opacity': this.opts.icons ? 0.95 : this.opts.strokeOpacity ?? 1, 'line-width': this.opts.strokeWeight ?? 5, ...(this.opts.icons ? { 'line-dasharray': [2, 2] } : {}) } });
            };
            if (raw.loaded())
                draw();
            else {
                raw.on('load', draw);
                this.cleanup = () => raw.off('load', draw);
            }
        }
    }
    class Geocoder {
        geocode(request: {
            address: string;
        }, callback: (results: {
            geometry: {
                location: {
                    lat(): number;
                    lng(): number;
                };
            };
            formatted_address?: string;
        }[] | null, status: string) => void) {
            void geocodeWithFreeProvider(request.address, tenantId).then(c => callback(c ? [{ geometry: { location: { lat: () => c.latitude, lng: () => c.longitude } }, formatted_address: c.formattedAddress }] : [], c ? 'OK' : 'ZERO_RESULTS')).catch(() => callback(null, 'PROVIDER_UNAVAILABLE'));
        }
    }
    return { maps: { Map: MapView, Marker, Polyline, InfoWindow, LatLngBounds: Bounds, Geocoder, Size: class {
                constructor(public width: number, public height: number) { }
            }, Point: class {
                constructor(public x: number, public y: number) { }
            }, event: { trigger: (map, event) => { if (event === 'resize')
                    (map as MapView).raw.resize(); } } } };
}
