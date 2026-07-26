import type {
  BodyMapMarkerType,
  BodyMapModelSelection,
} from '@/types/modules/bodyMap';
import {
  ANATOMICAL_ZONES,
  getAnatomicalPath,
  getAnatomicalZone,
  type AnatomicalZone,
} from './anatomicalZones';

export type BodyMapFindingDefinition = {
  id: BodyMapMarkerType;
  label: string;
  description: string;
  clinicalTags: readonly string[];
  pressureRelevant: boolean;
  requiresEscalationReview: boolean;
};

export const BODY_MAP_FINDING_DEFINITIONS: readonly BodyMapFindingDefinition[] = [
  {
    id: 'wunde',
    label: 'Wunde',
    description: 'Offene oder geschlossene traumatische beziehungsweise chronische Wunde.',
    clinicalTags: ['wunde'],
    pressureRelevant: false,
    requiresEscalationReview: false,
  },
  {
    id: 'dekubitus',
    label: 'Dekubitus',
    description: 'Druckbedingte Schädigung von Haut oder tieferem Gewebe.',
    clinicalTags: ['dekubitus'],
    pressureRelevant: true,
    requiresEscalationReview: true,
  },
  {
    id: 'druckverletzung_medizinprodukt',
    label: 'Druckverletzung durch Medizinprodukt',
    description: 'Form und Lokalisation entsprechen einem eingesetzten Medizinprodukt.',
    clinicalTags: ['medizinprodukt', 'dekubitus'],
    pressureRelevant: true,
    requiresEscalationReview: true,
  },
  {
    id: 'tiefe_gewebeschaedigung',
    label: 'Tiefe Gewebeschädigung',
    description: 'Persistierende dunkelrote, weinrote oder violette Gewebeveränderung.',
    clinicalTags: ['dekubitus'],
    pressureRelevant: true,
    requiresEscalationReview: true,
  },
  {
    id: 'hautroetung',
    label: 'Hautrötung',
    description: 'Umschriebene oder diffuse Rötung, wegdrückbar oder nicht wegdrückbar.',
    clinicalTags: ['haut'],
    pressureRelevant: false,
    requiresEscalationReview: false,
  },
  {
    id: 'haematom',
    label: 'Hämatom',
    description: 'Einblutung oder sichtbare Verfärbung nach Trauma beziehungsweise spontan.',
    clinicalTags: ['haut'],
    pressureRelevant: false,
    requiresEscalationReview: false,
  },
  {
    id: 'schwellung',
    label: 'Schwellung / Ödem',
    description: 'Lokale Schwellung, Ödem oder Umfangsvermehrung.',
    clinicalTags: ['haut'],
    pressureRelevant: false,
    requiresEscalationReview: false,
  },
  {
    id: 'narbe',
    label: 'Narbe',
    description: 'Abgeheilte oder auffällige Narbenstruktur.',
    clinicalTags: ['haut'],
    pressureRelevant: false,
    requiresEscalationReview: false,
  },
  {
    id: 'verbrennung',
    label: 'Verbrennung / Verbrühung',
    description: 'Thermisch, chemisch oder elektrisch verursachte Gewebeschädigung.',
    clinicalTags: ['wunde'],
    pressureRelevant: false,
    requiresEscalationReview: true,
  },
  {
    id: 'hautveraenderung',
    label: 'Sonstige Hautveränderung',
    description: 'Nicht eindeutig zugeordnete Veränderung von Farbe, Struktur oder Oberfläche.',
    clinicalTags: ['haut'],
    pressureRelevant: false,
    requiresEscalationReview: false,
  },
  {
    id: 'schmerzpunkt',
    label: 'Schmerzpunkt',
    description: 'Lokal begrenzter Schmerz ohne zwingend sichtbaren Hautbefund.',
    clinicalTags: ['schmerz'],
    pressureRelevant: false,
    requiresEscalationReview: false,
  },
  {
    id: 'katheter',
    label: 'Katheter / Zugang',
    description: 'Eintrittsstelle, Verlauf oder Komplikation eines Katheters beziehungsweise Zugangs.',
    clinicalTags: ['katheter', 'medizinprodukt'],
    pressureRelevant: false,
    requiresEscalationReview: false,
  },
  {
    id: 'stoma',
    label: 'Stoma',
    description: 'Stomaanlage oder Veränderung der peristomalen Haut.',
    clinicalTags: ['stoma'],
    pressureRelevant: false,
    requiresEscalationReview: false,
  },
  {
    id: 'injektion',
    label: 'Injektionsstelle',
    description: 'Geplante oder bereits verwendete subkutane beziehungsweise intramuskuläre Stelle.',
    clinicalTags: ['injektion'],
    pressureRelevant: false,
    requiresEscalationReview: false,
  },
  {
    id: 'verband',
    label: 'Verband / Auflage',
    description: 'Lage und Zustand einer Wundauflage oder eines Verbandes.',
    clinicalTags: ['verband'],
    pressureRelevant: false,
    requiresEscalationReview: false,
  },
  {
    id: 'sonstiges',
    label: 'Sonstiger Befund',
    description: 'Freie klinische Dokumentation, wenn keine andere Auswahl passt.',
    clinicalTags: [],
    pressureRelevant: false,
    requiresEscalationReview: false,
  },
] as const;

const GENITAL_ZONE_PREFIXES = {
  penis: ['penis', 'eichel', 'harnroehrenoeffnung-penis', 'skrotum'],
  vulva: [
    'vulva',
    'labium-majus',
    'labium-minus',
    'klitorisregion',
    'harnroehrenoeffnung-vulva',
    'vaginaloeffnung',
  ],
} as const;

function isZoneInFamily(zoneId: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => zoneId === prefix || zoneId.startsWith(`${prefix}-`));
}

export function isAnatomicalZoneCompatible(
  zone: AnatomicalZone,
  selection: BodyMapModelSelection,
): boolean {
  const penisZone = isZoneInFamily(zone.id, GENITAL_ZONE_PREFIXES.penis);
  const vulvaZone = isZoneInFamily(zone.id, GENITAL_ZONE_PREFIXES.vulva);
  if (!penisZone && !vulvaZone) return true;
  if (selection.sex === 'maennlich') return !vulvaZone;
  if (selection.sex === 'weiblich') return !penisZone;
  if (selection.genitalAnatomy === 'penis') return !vulvaZone;
  if (selection.genitalAnatomy === 'vulva') return !penisZone;
  return false;
}

function descendantsOf(zoneId: string): AnatomicalZone[] {
  const directChildren = ANATOMICAL_ZONES.filter((entry) => entry.parentId === zoneId);
  const grandchildren = directChildren.flatMap((child) =>
    ANATOMICAL_ZONES.filter((entry) => entry.parentId === child.id),
  );
  return [...directChildren, ...grandchildren];
}

/**
 * Liefert eine begrenzte, anatomisch nachvollziehbare Auswahlliste rund um die
 * tatsächlich getroffene Mesh-Zone. Der exakte Treffer bleibt immer an erster
 * Stelle; anschließend folgen feinere Unterzonen und unmittelbar benachbarte
 * Zonen desselben anatomischen Elternbereichs.
 */
export function resolveAnatomicalCandidates(
  hitZoneId: string,
  selection: BodyMapModelSelection,
  limit = 14,
): AnatomicalZone[] {
  const hitZone = getAnatomicalZone(hitZoneId);
  if (!hitZone) return [];
  const siblings = hitZone.parentId
    ? ANATOMICAL_ZONES.filter((entry) => entry.parentId === hitZone.parentId)
    : [];
  const parent = hitZone.parentId ? getAnatomicalZone(hitZone.parentId) : null;
  const ordered = [
    hitZone,
    ...descendantsOf(hitZone.id),
    ...siblings,
    ...(parent ? [parent] : []),
  ];
  const seen = new Set<string>();
  return ordered
    .filter((zone) => {
      if (seen.has(zone.id) || !isAnatomicalZoneCompatible(zone, selection)) return false;
      if (
        (hitZone.laterality === 'links' || hitZone.laterality === 'rechts') &&
        (zone.laterality === 'links' || zone.laterality === 'rechts') &&
        zone.laterality !== hitZone.laterality
      ) {
        return false;
      }
      seen.add(zone.id);
      return true;
    })
    .slice(0, limit);
}

export function recommendedFindingDefinitions(
  zoneId: string,
): BodyMapFindingDefinition[] {
  const zone = getAnatomicalZone(zoneId);
  if (!zone) return [...BODY_MAP_FINDING_DEFINITIONS];
  const recommended = BODY_MAP_FINDING_DEFINITIONS.filter((definition) => {
    if (zone.pressureRisk && definition.pressureRelevant) return true;
    return definition.clinicalTags.some((tag) => zone.clinicalTags.includes(tag));
  });
  const remaining = BODY_MAP_FINDING_DEFINITIONS.filter(
    (definition) => !recommended.some((entry) => entry.id === definition.id),
  );
  return [...recommended, ...remaining];
}

export function markerMatchesModelSelection(
  marker: {
    modelId?: string | null;
    ageGroup?: string | null;
    sex?: string | null;
    genitalAnatomy?: string | null;
    chestAnatomy?: string | null;
  },
  selection: BodyMapModelSelection,
  baseModelId: string,
): boolean {
  if (marker.modelId !== baseModelId) return false;
  if (marker.ageGroup && marker.ageGroup !== selection.ageGroup) return false;
  if (marker.sex && marker.sex !== selection.sex) return false;
  if (selection.sex !== 'divers') return true;
  return (
    (!marker.genitalAnatomy || marker.genitalAnatomy === selection.genitalAnatomy) &&
    (!marker.chestAnatomy || marker.chestAnatomy === selection.chestAnatomy)
  );
}

export function buildClinicalLocationSnapshot(zoneId: string) {
  const zone = getAnatomicalZone(zoneId);
  return {
    anatomicalZoneId: zoneId,
    anatomicalPath: getAnatomicalPath(zoneId).map((entry) => entry.id),
    anatomicalLabels: getAnatomicalPath(zoneId).map((entry) => entry.label),
    laterality: zone?.laterality ?? 'nicht_anwendbar',
    sensitiveArea: zone?.sensitive ?? false,
    pressureRiskArea: zone?.pressureRisk ?? false,
    clinicalTags: zone?.clinicalTags ?? [],
  };
}
