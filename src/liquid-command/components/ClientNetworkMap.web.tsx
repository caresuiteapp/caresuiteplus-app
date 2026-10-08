import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getGoogleMapsBrowserKey } from '@/lib/maps/getGoogleMapsBrowserKey';
import {
  loadGoogleMapsApi,
  subscribeGoogleMapsFailure,
  type GoogleGeocoderInstance,
  type GoogleMapInstance,
  type GoogleMarkerInstance,
  type GoogleMapsNamespace,
} from '@/lib/maps/googleMapsLoader';
import type { ClientListItem } from '@/types/modules/office';
import { LiquidGlyph } from './LiquidPrimitives';
import { liquidClassicColors as liquidColors, liquidRadius } from '../foundation/tokens';

export type ClientNetworkMapProps = {
  clients: ClientListItem[];
  tenantId?: string | null;
  height?: number;
  onClientSelect?: (clientId: string) => void;
};

const coordinateCache = new Map<string, { latitude: number; longitude: number; expiresAt: number }>();

type ClientMapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  subtitle: string;
};

function clientAddress(client: ClientListItem): string {
  return [
    client.street?.trim(),
    [client.zip?.trim(), client.city?.trim()].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');
}

function geocode(
  geocoder: GoogleGeocoderInstance,
  address: string,
  tenantId: string | null,
): Promise<{ latitude: number; longitude: number } | null> {
  const cached = coordinateCache.get(`${tenantId}:${address}`);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached);
  if(cached)coordinateCache.delete(`${tenantId}:${address}`);

  return new Promise((resolve) => {
    geocoder.geocode({ address }, (results, status) => {
      const first = status === 'OK' ? results?.[0] : null;
      const coordinate = first
        ? {
            latitude: first.geometry.location.lat(),
            longitude: first.geometry.location.lng(),
          }
        : null;
      if (coordinate) { if(coordinateCache.size > 500)coordinateCache.clear(); coordinateCache.set(`${tenantId}:${address}`, {...coordinate,expiresAt:Date.now()+24*60*60_000}); }
      resolve(coordinate);
    });
  });
}

async function geocodeClients(
  clients: ClientListItem[],
  geocoder: GoogleGeocoderInstance,
  onProgress: (markers: ClientMapMarker[], processed: number) => void,
  isCancelled: () => boolean,
  tenantId: string | null,
): Promise<void> {
  const pending = clients
    .map((client) => ({ client, address: clientAddress(client) }))
    .filter((entry) => Boolean(entry.address));
  const markers: ClientMapMarker[] = [];
  let cursor = 0;
  let processed = 0;

  const worker = async () => {
    while (!isCancelled()) {
      const index = cursor;
      cursor += 1;
      const entry = pending[index];
      if (!entry) return;
      const coordinate = await geocode(geocoder, entry.address, tenantId);
      processed += 1;
      if (coordinate) {
        markers.push({
          id: entry.client.id,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          label: `${entry.client.firstName} ${entry.client.lastName}`,
          subtitle: entry.address,
        });
      }
      if (!isCancelled()) onProgress([...markers], processed);
    }
  };

  await Promise.all(Array.from({ length: Math.min(1, pending.length) }, () => worker()));
}

function pulsingMarkerIcon(): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <defs>
        <filter id="g" x="-90%" y="-90%" width="280%" height="280%">
          <feGaussianBlur stdDeviation="3.2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle cx="32" cy="32" r="15" fill="none" stroke="#1683ff" stroke-width="2" opacity=".72">
        <animate attributeName="r" values="15;29" dur="2.15s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values=".72;0" dur="2.15s" repeatCount="indefinite"/>
      </circle>
      <circle cx="32" cy="32" r="13" fill="#ffffff" stroke="#1683ff" stroke-width="2" filter="url(#g)"/>
      <circle cx="32" cy="32" r="5.3" fill="#1683ff"/>
      <circle cx="32" cy="32" r="2.8" fill="#ffffff"/>
    </svg>
  `)}`;
}

export function ClientNetworkMap({
  clients,
  tenantId = null,
  height = 380,
  onClientSelect,
}: ClientNetworkMapProps) {
  const [retry, setRetry] = useState(0);
  const [markers, setMarkers] = useState<ClientMapMarker[]>([]);
  const [processed, setProcessed] = useState(0);
  const [providerReady, setProviderReady] = useState<boolean | null>(null);
  const [google, setGoogle] = useState<GoogleMapsNamespace | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRefs = useRef<Map<string, GoogleMarkerInstance>>(new Map());
  const onSelectRef=useRef(onClientSelect);onSelectRef.current=onClientSelect;
  const fittedRef=useRef(false);
  const addressableCount = useMemo(
    () => clients.filter((client) => Boolean(clientAddress(client))).length,
    [clients],
  );
  const clientKey = useMemo(
    () => clients.map((client) => `${client.id}:${client.updatedAt ?? ''}`).join('|'),
    [clients],
  );

  useEffect(() => {
    let cancelled = false;
    let providerFailed = false;
    const unsubscribe = subscribeGoogleMapsFailure(() => {
      providerFailed = true;
      if (!cancelled) {
        setProviderReady(false);
        setGoogle(null);
      }
    });
    setProviderReady(null);
    setMarkers([]);
    setProcessed(0);

    void getGoogleMapsBrowserKey(tenantId)
      .then(async (key) => {
        if (cancelled || providerFailed) return;
        setProviderReady(Boolean(key));
        if (!key) return;
        const mapsNamespace = await loadGoogleMapsApi(key, tenantId);
        if (cancelled || providerFailed) return;
        setGoogle(mapsNamespace);
        const geocoder = new mapsNamespace.maps.Geocoder();
        await geocodeClients(
          clients,
          geocoder,
          (nextMarkers, nextProcessed) => {
            setMarkers(nextMarkers);
            setProcessed(nextProcessed);
          },
          () => cancelled || providerFailed,
          tenantId,
        );
      })
      .catch(() => {
        if (!cancelled) setProviderReady(false);
      });

    return () => {
      cancelled = true;
      unsubscribe();
      markerRefs.current.forEach(marker=>marker.setMap(null)); markerRefs.current.clear();fittedRef.current=false;
      mapRef.current?.dispose?.(); mapRef.current=null;
    };
  }, [clientKey, clients, tenantId, retry]);

  useEffect(() => {
    if (!google || !mapContainerRef.current || !markers.length) return;
    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(mapContainerRef.current, {
        center: { lat: markers[0].latitude, lng: markers[0].longitude },
        zoom: markers.length === 1 ? 15 : 12,
        mapTypeId: 'roadmap',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,

      });
      mapRef.current.onError?.(()=>setProviderReady(false));
    }

    const ids=new Set(markers.map(item=>item.id));
    markerRefs.current.forEach((marker,id)=>{if(!ids.has(id)){marker.setMap(null);markerRefs.current.delete(id);}});
    const markerIcon=pulsingMarkerIcon();
    markers.forEach(item=>{
      const existing=markerRefs.current.get(item.id);
      if(existing){existing.setPosition?.({lat:item.latitude,lng:item.longitude});return;}
      const marker=new google.maps.Marker({map:mapRef.current??undefined,position:{lat:item.latitude,lng:item.longitude},title:`${item.label} · ${item.subtitle}`,icon:{url:markerIcon,scaledSize:new google.maps.Size(50,50),anchor:new google.maps.Point(25,25)}});
      marker.addListener('click',()=>onSelectRef.current?.(item.id));markerRefs.current.set(item.id,marker);
    });
    if(!fittedRef.current && processed>=addressableCount){
      const bounds=new google.maps.LatLngBounds();markers.forEach(item=>bounds.extend({lat:item.latitude,lng:item.longitude}));mapRef.current.fitBounds(bounds);fittedRef.current=true;
    }
  }, [google, markers, processed, addressableCount]);

  useEffect(() => {
    if (!google || !mapRef.current || !mapContainerRef.current || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      if (mapRef.current) google.maps.event.trigger(mapRef.current, 'resize');
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, [google]);

  if (providerReady === false || (!markers.length && processed >= addressableCount)) {
    return (
      <View style={[styles.fallback, { minHeight: height }]}>
        <LiquidGlyph active glyph="⌖" size={34} />
        <Text style={styles.fallbackTitle}>{clients.length} Klient:innen im Versorgungsnetz</Text>
        <Text style={styles.fallbackDetail}>
          Die Kartenansicht benötigt vollständige, eindeutig zuordenbare Adressen.
          Der Adressdienst ist möglicherweise vorübergehend nicht erreichbar. Vorhandene Orte bleiben unten direkt auswählbar.
        </Text>
        <Pressable accessibilityRole="button" onPress={()=>setRetry(v=>v+1)}><Text style={styles.fallbackDetail}>Erneut versuchen</Text></Pressable>
        <View style={styles.clientChips}>
          {clients.slice(0, 12).map((client) => (
            <Pressable
              key={client.id}
              accessibilityRole="button"
              onPress={() => onClientSelect?.(client.id)}
              style={({ pressed }) => [styles.clientChip, pressed && styles.pressed]}
            >
              <Text style={styles.clientChipLabel}>
                {client.firstName} {client.lastName}
              </Text>
              <Text style={styles.clientChipMeta}>{client.zip ?? ''} {client.city ?? ''}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <style>
        {`
          #healthos-client-map [role="button"]:focus,
          #healthos-client-map img:focus {
            outline: none !important;
          }
          #healthos-client-map [role="button"]:focus-visible,
          #healthos-client-map img:focus-visible {
            border-radius: 999px !important;
            box-shadow: 0 0 0 3px rgba(112,181,255,.9), 0 0 18px rgba(22,131,255,.75) !important;
          }
        `}
      </style>
      <View style={[styles.mapFrame, { height }]}>
        <div
          id="healthos-client-map"
          ref={mapContainerRef}
          style={{ width: '100%', height: '100%', minHeight: height }}
        />
        {!markers.length ? (
          <View style={styles.mapLoading}>
            <LiquidGlyph active glyph="⌖" size={34} />
            <Text style={styles.fallbackTitle}>Klient:innenkarte wird aufgebaut</Text>
            <Text style={styles.fallbackDetail}>Adressen und Ortsnamen werden mandantenbezogen aufgelöst.</Text>
          </View>
        ) : null}
      </View>
      <View pointerEvents="none" style={styles.progressBadge}>
        <Text style={styles.progressCount}>{markers.length}/{clients.length}</Text>
        <Text style={styles.progressLabel}>
          Klient:innen auf der Karte
          {processed < addressableCount ? ' · Adressen werden geladen' : markers.length < clients.length ? ` · ${clients.length-markers.length} ohne eindeutigen Standort` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
  },
  mapFrame: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: liquidRadius.small,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: '#EEF6FF',
  },
  mapLoading: {
    ...StyleSheet.absoluteFill,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#071A31',
  },
  progressBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    maxWidth: '72%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: liquidRadius.control,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  progressCount: {
    color: '#0B1220',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  progressLabel: {
    color: '#475569',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  fallback: {
    width: '100%',
    padding: 22,
    overflow: 'hidden',
    borderRadius: liquidRadius.small,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: '#071A31',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fallbackTitle: {
    color: liquidColors.white,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  fallbackDetail: {
    maxWidth: 650,
    color: liquidColors.white56,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  clientChips: {
    marginTop: 8,
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
  },
  clientChip: {
    minWidth: 130,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: liquidRadius.control,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    backgroundColor: liquidColors.white08,
  },
  clientChipLabel: {
    color: liquidColors.white88,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  clientChipMeta: {
    color: liquidColors.white56,
    fontSize: 9,
    lineHeight: 13,
  },
  pressed: {
    opacity: 0.76,
  },
});
