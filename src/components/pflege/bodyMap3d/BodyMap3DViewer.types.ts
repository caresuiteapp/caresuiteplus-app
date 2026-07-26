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
  /**
   * Zeigt die intern geprüften GLB-Referenzkörper bereits vor der medizinischen
   * Freigabe. Die Oberfläche muss den technischen Status dabei sichtbar
   * ausweisen; eine medizinische Freigabe wird dadurch nicht vorgetäuscht.
   */
  allowTechnicalMeshPreview?: boolean;
  /** Große technische/medizinische Prüfansicht statt Einbettung im Pflegeformular. */
  presentationMode?: 'embedded' | 'review';
  onSurfacePress: (hit: BodyMapSurfaceHit) => void;
  onMarkerPress?: (marker: BodyMap3DMarker) => void;
};
