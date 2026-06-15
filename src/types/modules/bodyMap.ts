export type BodyMapGender = 'weiblich' | 'maennlich' | 'neutral';

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
  | 'hautroetung'
  | 'haematom'
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
