import type { FeatureCollection, LineString, Point, Feature } from 'geojson';
import type { AssistLiveMapMarker, AssistLiveRoutePoint } from '@/lib/assist/assistMapProvider';
export const validNativeMapPosition = (point: { latitude: number; longitude: number }) =>
  Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 85.051129 && Math.abs(point.longitude) <= 180;
export function nativeMapMarkers(markers: readonly AssistLiveMapMarker[], selected?: string | null): FeatureCollection<Point> {
  return { type: 'FeatureCollection', features: markers.filter(validNativeMapPosition).map(row => ({
    type: 'Feature', id: row.id, properties: { markerId: row.id, selected: row.id === selected },
    geometry: { type: 'Point', coordinates: [row.longitude, row.latitude] },
  })) };
}
export function nativeMapLines(segments: readonly (readonly AssistLiveRoutePoint[])[]): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = [];
  for (const segment of segments) {
    let coordinates: number[][] = [];
    const finish = () => { if (coordinates.length > 1) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }); coordinates = []; };
    for (const point of segment) { if (validNativeMapPosition(point)) coordinates.push([point.longitude, point.latitude]); else finish(); }
    finish();
  }
  return { type: 'FeatureCollection', features };
}
export function nativeMapBounds(points: readonly { latitude: number; longitude: number }[]): [number, number, number, number] | null {
  const valid = points.filter(validNativeMapPosition); if (!valid.length) return null;
  const longitudes = valid.map(p => p.longitude), latitudes = valid.map(p => p.latitude);
  return [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)];
}
