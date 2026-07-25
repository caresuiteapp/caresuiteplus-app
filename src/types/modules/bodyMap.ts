/**
 * Medizinische 3D-Bodymap
 *
 * Die alten Werte bleiben während der Datenmigration lesbar. Neue Datensätze
 * verwenden `BodyMapSex`, `BodyMapAgeGroup` und die modularen Anatomieangaben.
 */
export type LegacyBodyMapGender = 'weiblich' | 'maennlich' | 'neutral';

export type BodyMapSex = 'weiblich' | 'maennlich' | 'divers';

export type BodyMapGender = LegacyBodyMapGender | 'divers';

export type BodyMapAgeGroup =
  | 'baby'
  | 'kleinkind'
  | 'kind'
  | 'junger_erwachsener'
  | 'erwachsener';

export type BodyMapGenitalAnatomy = 'penis' | 'vulva' | 'unbekannt';

export type BodyMapChestAnatomy = 'brueste' | 'keine_brueste' | 'unbekannt';

export type BodyMapSkinTone =
  | 'sehr_hell'
  | 'hell'
  | 'mittel'
  | 'dunkel'
  | 'sehr_dunkel';

export type BodyMapModelId =
  | 'body-baby-maennlich'
  | 'body-baby-weiblich'
  | 'body-baby-divers'
  | 'body-kleinkind-maennlich'
  | 'body-kleinkind-weiblich'
  | 'body-kleinkind-divers'
  | 'body-kind-maennlich'
  | 'body-kind-weiblich'
  | 'body-kind-divers'
  | 'body-junger-erwachsener-maennlich'
  | 'body-junger-erwachsener-weiblich'
  | 'body-junger-erwachsener-divers'
  | 'body-erwachsener-maennlich'
  | 'body-erwachsener-weiblich'
  | 'body-erwachsener-divers';

export type BodyMapAnatomyPackId =
  | 'anatomy-pack-penis'
  | 'anatomy-pack-vulva'
  | 'anatomy-pack-unbekannt';

export type BodyMapModelSelection = {
  sex: BodyMapSex;
  ageGroup: BodyMapAgeGroup;
  genitalAnatomy: BodyMapGenitalAnatomy | null;
  chestAnatomy: BodyMapChestAnatomy | null;
  skinTone: BodyMapSkinTone;
};

export type BodyMapView = 'vorderseite' | 'rueckseite';

export type BodyMapRegion =
  | 'kopf'
  | 'rumpf'
  | 'arm_links'
  | 'arm_rechts'
  | 'bein_links'
  | 'bein_rechts'
  | 'fuesse'
  | 'sakral'
  | 'intim_klinisch';

export type BodyMapMarkerType =
  | 'wunde'
  | 'dekubitus'
  | 'druckverletzung_medizinprodukt'
  | 'tiefe_gewebeschaedigung'
  | 'hautroetung'
  | 'haematom'
  | 'schwellung'
  | 'narbe'
  | 'verbrennung'
  | 'hautveraenderung'
  | 'schmerzpunkt'
  | 'katheter'
  | 'stoma'
  | 'injektion'
  | 'verband'
  | 'sonstiges';

export type BodyMapMarker = {
  id: string;
  tenantId: string;
  clientId: string;
  woundId: string | null;
  gender: BodyMapGender;
  view: BodyMapView;
  region: BodyMapRegion;
  markerType: BodyMapMarkerType;
  xPercent: number;
  yPercent: number;
  note: string;
  modelId?: BodyMapModelId | null;
  anatomyPackId?: BodyMapAnatomyPackId | null;
  ageGroup?: BodyMapAgeGroup | null;
  sex?: BodyMapSex | null;
  genitalAnatomy?: BodyMapGenitalAnatomy | null;
  chestAnatomy?: BodyMapChestAnatomy | null;
  skinTone?: BodyMapSkinTone | null;
  anatomicalZoneId?: string | null;
  surfacePoint?: BodyMapSurfacePoint | null;
  pressureClassification?: string | null;
  findingStatus?: string | null;
  findingDetails?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BodyMapSurfacePoint = {
  /** Objektlokale, normalisierte Koordinate des getroffenen Meshs. */
  localPosition: { x: number; y: number; z: number };
  /** Weltkoordinate beim Setzen; dient der Reproduzierbarkeit und Migration. */
  worldPosition: { x: number; y: number; z: number };
  /** Modellwurzel-lokale Koordinate; bleibt bei Drehen und Zoomen stabil. */
  modelPosition?: { x: number; y: number; z: number };
  /** Oberflächennormale für einen bündig ausgerichteten 3D-Marker. */
  normal: { x: number; y: number; z: number };
  /** Normalenrichtung im Koordinatensystem der Modellwurzel. */
  modelNormal?: { x: number; y: number; z: number };
  /** UV-Koordinate, sofern das medizinische Modell UVs bereitstellt. */
  uv: { u: number; v: number } | null;
  meshName: string;
  primitiveIndex: number | null;
  triangleIndex: number | null;
};

export type BodyMap3DMarker = BodyMapMarker & {
  modelId: BodyMapModelId;
  anatomyPackId: BodyMapAnatomyPackId | null;
  ageGroup: BodyMapAgeGroup;
  sex: BodyMapSex;
  genitalAnatomy: BodyMapGenitalAnatomy | null;
  chestAnatomy: BodyMapChestAnatomy | null;
  skinTone: BodyMapSkinTone;
  anatomicalZoneId: string;
  surfacePoint: BodyMapSurfacePoint;
};

export type BodyMapMarkerCreateInput = {
  clientId: string;
  gender: LegacyBodyMapGender;
  view: BodyMapView;
  region: BodyMapRegion;
  markerType: BodyMapMarkerType;
  xPercent: number;
  yPercent: number;
  note: string;
  woundId?: string | null;
  modelId?: BodyMapModelId | null;
  anatomyPackId?: BodyMapAnatomyPackId | null;
  ageGroup?: BodyMapAgeGroup | null;
  sex?: BodyMapSex | null;
  genitalAnatomy?: BodyMapGenitalAnatomy | null;
  chestAnatomy?: BodyMapChestAnatomy | null;
  skinTone?: BodyMapSkinTone | null;
  anatomicalZoneId?: string | null;
  surfacePoint?: BodyMapSurfacePoint | null;
  pressureClassification?: string | null;
  findingStatus?: string | null;
  findingDetails?: Record<string, unknown>;
};

export type BodyMapFindingStatus =
  | 'verdacht'
  | 'aktiv'
  | 'in_behandlung'
  | 'heilend'
  | 'abgeheilt'
  | 'geschlossen'
  | 'wiedereroeffnet';

export type BodyMapCapturePhase =
  | 'initial'
  | 'before_cleaning'
  | 'after_cleaning'
  | 'after_debridement'
  | 'dressing_change'
  | 'progress'
  | 'closure'
  | 'reopening';

export type BodyMapClinicalMedia = {
  id: string;
  tenantId: string;
  clientId: string;
  markerId: string;
  storagePath: string;
  mediaType: 'photo' | 'measurement_photo' | 'document' | 'video';
  capturePhase: BodyMapCapturePhase | null;
  originalFileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  capturedAt: string | null;
  measurementReferencePresent: boolean;
  note: string;
  createdAt: string;
};

export type BodyMapFindingHistoryEntry = {
  id: string;
  markerId: string;
  eventType:
    | 'created'
    | 'updated'
    | 'classified'
    | 'treatment'
    | 'photo'
    | 'healing'
    | 'closed'
    | 'reopened';
  snapshot: Record<string, unknown>;
  note: string;
  createdAt: string;
};

export type PressureInjuryAssessmentInput = {
  classification: string;
  presentOnAdmission?: boolean | null;
  deviceRelated: boolean;
  medicalDevice?: string | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  depthCm?: number | null;
  tissuePercentages: Record<string, number>;
  exudate: {
    amount?: 'kein' | 'gering' | 'mittel' | 'stark';
    character?: 'seroes' | 'blutig' | 'seroes_blutig' | 'eitrig';
    odor?: 'kein' | 'auffaellig';
  };
  pain: {
    score?: number | null;
    scale?: 'NRS' | 'VAS' | 'BESD';
    atRest?: boolean;
    duringCare?: boolean;
  };
  infectionSigns: Record<string, boolean>;
  escalationFlags: string[];
  treatmentPlan: {
    cleansing?: string;
    dressing?: string;
    interval?: string;
  };
  pressureReliefPlan: {
    positioning?: string;
    interval?: string;
    aids?: string;
    mobility?: string;
  };
  nextReviewAt?: string | null;
};

export type PressureInjuryAssessment = PressureInjuryAssessmentInput & {
  id: string;
  tenantId: string;
  clientId: string;
  markerId: string;
  assessedAt: string;
  createdAt: string;
};
