import type {
  BodyMap3DMarker,
  BodyMapModelSelection,
  BodyMapSurfacePoint,
} from '@/types/modules/bodyMap';

export type BodyMapSurfaceHit = {
  anatomicalZoneId: string;
  surfacePoint: BodyMapSurfacePoint;
};

export type BodyMap3DViewerProps = {
  selection: BodyMapModelSelection;
  markers: readonly BodyMap3DMarker[];
  selectedMarkerId?: string | null;
  disabled?: boolean;
  onSurfacePress: (hit: BodyMapSurfaceHit) => void;
  onMarkerPress?: (marker: BodyMap3DMarker) => void;
};
