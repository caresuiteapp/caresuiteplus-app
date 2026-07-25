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
  createdAt: string;
  updatedAt: string;
};

export type BodyMapSurfacePoint = {
  /** Objektlokale, normalisierte Koordinate des getroffenen Meshs. */
  localPosition: { x: number; y: number; z: number };
  /** Weltkoordinate beim Setzen; dient der Reproduzierbarkeit und Migration. */
  worldPosition: { x: number; y: number; z: number };
  /** Oberflächennormale für einen bündig ausgerichteten 3D-Marker. */
  normal: { x: number; y: number; z: number };
  /** UV-Koordinate, sofern das medizinische Modell UVs bereitstellt. */
  uv: { u: number; v: number } | null;
  meshName: string;
  primitiveIndex: number | null;
  triangleIndex: number | null;
};

export type BodyMap3DMarker = BodyMapMarker & {
  modelId: BodyMapModelId;
  anatomyPackId: BodyMapAnatomyPackId | null;
  anatomicalZoneId: string;
  surfacePoint: BodyMapSurfacePoint;
};
