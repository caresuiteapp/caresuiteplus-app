import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getGoogleMapsBrowserKey } from '@/lib/maps/getGoogleMapsBrowserKey';
import {
  loadGoogleMapsApi,
  type GoogleGeocoderInstance,
  type GoogleMapInstance,
  type GoogleMarkerInstance,
  type GoogleMapsNamespace,
  type GooglePolylineInstance,
} from '@/lib/maps/googleMapsLoader';
import type { ClientListItem } from '@/types/modules/office';
import { liquidColors, liquidRadius } from '../foundation/tokens';

export type ClientNetworkMapProps = {
  clients: ClientListItem[];
  tenantId?: string | null;
  height?: number;
  onClientSelect?: (clientId: string) => void;
};

const coordinateCache = new Map<string, { latitude: number; longitude: number } | null>();

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
): Promise<{ latitude: number; longitude: number } | null> {
  const cached = coordinateCache.get(address);
  if (cached !== undefined) return Promise.resolve(cached);

  return new Promise((resolve) => {
    geocoder.geocode({ address }, (results, status) => {
      const first = status === 'OK' ? results?.[0] : null;
      const coordinate = first
        ? {
            latitude: first.geometry.location.lat(),
            longitude: first.geometry.location.lng(),
          }
        : null;
      coordinateCache.set(address, coordinate);
      resolve(coordinate);
    });
  });
}

async function geocodeClients(
  clients: ClientListItem[],
  geocoder: GoogleGeocoderInstance,
  onProgress: (markers: ClientMapMarker[], processed: number) => void,
  isCancelled: () => boolean,
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
      const coordinate = await geocode(geocoder, entry.address);
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

  await Promise.all(Array.from({ length: Math.min(4, pending.length) }, () => worker()));
}

export function ClientNetworkMap({
  clients,
  tenantId = null,
  height = 320,
  onClientSelect,
}: ClientNetworkMapProps) {
  const [markers, setMarkers] = useState<ClientMapMarker[]>([]);
  const [processed, setProcessed] = useState(0);
  const [providerReady, setProviderReady] = useState<boolean | null>(null);
  const [google, setGoogle] = useState<GoogleMapsNamespace | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRefs = useRef<GoogleMarkerInstance[]>([]);
  const routeRefs = useRef<GooglePolylineInstance[]>([]);
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
    setMarkers([]);
    setProcessed(0);

    void getGoogleMapsBrowserKey(tenantId)
      .then(async (key) => {
        if (cancelled) return;
        setProviderReady(Boolean(key));
        if (!key) return;
        const google = await loadGoogleMapsApi(key);
        if (cancelled) return;
        setGoogle(google);
        const geocoder = new google.maps.Geocoder();
        await geocodeClients(
          clients,
          geocoder,
          (nextMarkers, nextProcessed) => {
            setMarkers(nextMarkers);
            setProcessed(nextProcessed);
          },
          () => cancelled,
        );
      })
      .catch(() => {
        if (!cancelled) setProviderReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clientKey, clients, tenantId]);

  useEffect(() => {
    if (!google || !mapContainerRef.current || !markers.length) return;
    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(mapContainerRef.current, {
        center: { lat: markers[0].latitude, lng: markers[0].longitude },
        zoom: markers.length === 1 ? 15 : 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: HEALTH_OS_CLIENT_MAP_STYLE,
      });
    }

    markerRefs.current.forEach((marker) => marker.setMap(null));
    routeRefs.current.forEach((route) => route.setMap(null));
    const markerIcon = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
        <defs>
          <filter id="g" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3.2" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <circle cx="20" cy="20" r="13" fill="#08284f" stroke="#55aaff" stroke-width="1.5" filter="url(#g)"/>
        <circle cx="20" cy="20" r="5.2" fill="#eaf5ff"/>
        <circle cx="20" cy="20" r="2.8" fill="#1683ff"/>
      </svg>
    `)}`;
    markerRefs.current = markers.map((item) => {
      const marker = new google.maps.Marker({
        map: mapRef.current ?? undefined,
        position: { lat: item.latitude, lng: item.longitude },
        title: `${item.label} · ${item.subtitle}`,
        icon: {
          url: markerIcon,
          scaledSize: new google.maps.Size(34, 34),
          anchor: new google.maps.Point(17, 17),
        },
      });
      marker.addListener('click', () => onClientSelect?.(item.id));
      return marker;
    });

    const routePairs = markers.flatMap((item, index) => {
      const previous = markers[index - 1];
      const branch = index > 3 && index % 3 === 0 ? markers[index - 3] : null;
      return [
        ...(previous ? [[previous, item] as const] : []),
        ...(branch ? [[branch, item] as const] : []),
      ];
    });
    routeRefs.current = routePairs.flatMap(([from, to]) => {
      const path = [
        { lat: from.latitude, lng: from.longitude },
        { lat: to.latitude, lng: to.longitude },
      ];
      const glow = new google.maps.Polyline({
        map: mapRef.current ?? undefined,
        path,
        geodesic: true,
        strokeColor: '#1683ff',
        strokeOpacity: 0.24,
        strokeWeight: 9,
      });
      const core = new google.maps.Polyline({
        map: mapRef.current ?? undefined,
        path,
        geodesic: true,
        strokeColor: '#2f92ff',
        strokeOpacity: 0.92,
        strokeWeight: 2,
      });
      return [glow, core];
    });

    if (markers.length === 1) {
      mapRef.current.setCenter({ lat: markers[0].latitude, lng: markers[0].longitude });
    } else {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((item) => bounds.extend({ lat: item.latitude, lng: item.longitude }));
      mapRef.current.fitBounds(bounds);
    }
  }, [google, markers, onClientSelect]);

  if (providerReady === false || (!markers.length && processed >= addressableCount)) {
    return (
      <View style={[styles.fallback, { minHeight: height }]}>
        <Text style={styles.fallbackGlyph}>⌖</Text>
        <Text style={styles.fallbackTitle}>{clients.length} Klient:innen im Versorgungsnetz</Text>
        <Text style={styles.fallbackDetail}>
          Die dauerhafte Kartenebene ist aktiv. Für geografische Marker müssen vollständige
          Adressen und der mandantenseitig freigegebene Kartenanbieter verfügbar sein.
        </Text>
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
      <View style={[styles.mapFrame, { height }]}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        {!markers.length ? (
          <View style={styles.mapLoading}>
            <Text style={styles.fallbackGlyph}>⌖</Text>
            <Text style={styles.fallbackTitle}>Klient:innenkarte wird aufgebaut</Text>
            <Text style={styles.fallbackDetail}>Adressen werden mandantenbezogen aufgelöst.</Text>
          </View>
        ) : null}
      </View>
      <View pointerEvents="none" style={styles.progressBadge}>
        <Text style={styles.progressCount}>{markers.length}/{clients.length}</Text>
        <Text style={styles.progressLabel}>
          Klient:innen dauerhaft auf der Karte
          {processed < addressableCount ? ' · Adressen werden geladen' : ''}
        </Text>
      </View>
    </View>
  );
}

const HEALTH_OS_CLIENT_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#04142b' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#779bc4' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#020b19' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#051a35' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#0b315e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#082348' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#13549a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#010918' }] },
] as const;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  mapFrame: {
    overflow: 'hidden',
    borderRadius: liquidRadius.small,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(2,14,32,0.88)',
  },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'rgba(2,14,32,0.82)',
  },
  progressBadge: {
    position: 'absolute',
    left: 16,
    bottom: 38,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: liquidRadius.control,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(6,21,43,0.9)',
  },
  progressCount: {
    color: liquidColors.white,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  progressLabel: {
    color: liquidColors.white64,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  fallback: {
    padding: 22,
    overflow: 'hidden',
    borderRadius: liquidRadius.small,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(2,14,32,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fallbackGlyph: {
    color: liquidColors.blue200,
    fontSize: 34,
    lineHeight: 38,
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
