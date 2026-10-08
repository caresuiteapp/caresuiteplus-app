import { useEffect, useRef, useState, type RefObject } from 'react';
import { loadGoogleMapsApi, type GoogleMapInstance, type GoogleMapsNamespace } from '@/lib/maps/googleMapsLoader';
export type StableMapOptions = {
    apiKey: string | null;
    containerRef: RefObject<HTMLDivElement | null>;
    center: {
        lat: number;
        lng: number;
    } | null;
    zoom?: number;
    enabled?: boolean;
    retryKey?: number;
    tenantId?: string | null;
};
export type StableMapResult = {
    map: GoogleMapInstance | null;
    google: GoogleMapsNamespace | null;
    ready: boolean;
    error: string | null;
};
/** One MapLibre instance per mounted view. Coordinate refreshes retain the camera. */
export function useStableGoogleMap({ apiKey, containerRef, center, zoom = 15, enabled = true, retryKey = 0, tenantId }: StableMapOptions): StableMapResult {
    const current = useRef({ center, zoom });
    current.current = { center, zoom };
    const [state, setState] = useState<StableMapResult>({ map: null, google: null, ready: false, error: null });
    useEffect(() => {
        if (!enabled || !containerRef.current)
            return;
        let cancelled = false;
        let instance: GoogleMapInstance | null = null;
        let unsubscribe: (() => void) | undefined;
        setState({ map: null, google: null, ready: false, error: null });
        void loadGoogleMapsApi(apiKey ?? undefined, tenantId).then(google => {
            if (cancelled || !containerRef.current || !current.current.center)
                return;
            instance = new google.maps.Map(containerRef.current, { center: current.current.center, zoom: current.current.zoom, fullscreenControl: true });
            unsubscribe = instance.onError?.(failure => { if (!cancelled)
                setState(prev => ({ ...prev, error: failure.message, ready: false })); });
            setState({ map: instance, google, ready: true, error: null });
        }).catch(error => { if (!cancelled)
            setState({ map: null, google: null, ready: false, error: error instanceof Error ? error.message : 'Karte konnte nicht geladen werden.' }); });
        return () => { cancelled = true; unsubscribe?.(); instance?.dispose?.(); };
    }, [apiKey, containerRef, enabled, retryKey, tenantId]);
    return state;
}
