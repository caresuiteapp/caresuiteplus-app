import {
  buildAdultMaleReferenceParts,
  buildBodyMapReferenceGlb,
  ellipsoidGeometry,
} from './bodymap-adult-male-reference-glb.mjs';
import { breastParts, vulvaParts } from './bodymap-adult-female-reference-glb.mjs';
import {
  AGE_PROFILES,
  buildAgeTransformedParts,
} from './bodymap-age-reference-glb.mjs';
import { withClinicalVisualSurface } from './bodymap-clinical-visual-surface.mjs';

const MALE_INTIMATE_ZONES = new Set([
  'surface-penis',
  'surface-glans',
  'surface-urethral-opening-penis',
  'surface-scrotum-left',
  'surface-scrotum-right',
]);
const FLAT_CHEST_ZONES = new Set([
  'surface-pectoral-left',
  'surface-pectoral-right',
  'surface-nipple-left',
  'surface-nipple-right',
]);

const ADULT_PROFILE = {
  label: 'Erwachsener',
  nominalHeightMeters: 1.72,
  developmentalStage: 'adult',
};

export const DIVERS_REFERENCE_VARIANTS = [
  {
    id: 'body-baby-divers',
    ageGroup: 'baby',
    genitalAnatomy: 'unbekannt',
    chestAnatomy: 'unbekannt',
    chestZoneContract: 'prepubertal',
  },
  {
    id: 'body-kleinkind-divers',
    ageGroup: 'kleinkind',
    genitalAnatomy: 'unbekannt',
    chestAnatomy: 'unbekannt',
    chestZoneContract: 'prepubertal',
  },
  {
    id: 'body-kind-divers',
    ageGroup: 'kind',
    genitalAnatomy: 'unbekannt',
    chestAnatomy: 'unbekannt',
    chestZoneContract: 'prepubertal',
  },
  {
    id: 'body-jugendlicher-divers',
    ageGroup: 'jugendlicher',
    genitalAnatomy: 'unbekannt',
    chestAnatomy: 'unbekannt',
    chestZoneContract: 'flat',
  },
  {
    id: 'body-junger-erwachsener-divers',
    ageGroup: 'junger-erwachsener',
    genitalAnatomy: 'unbekannt',
    chestAnatomy: 'unbekannt',
    chestZoneContract: 'flat',
  },
  {
    id: 'body-erwachsener-divers',
    ageGroup: 'erwachsener',
    genitalAnatomy: 'unbekannt',
    chestAnatomy: 'unbekannt',
    chestZoneContract: 'flat',
  },
  {
    id: 'body-senior-divers',
    ageGroup: 'senior',
    genitalAnatomy: 'unbekannt',
    chestAnatomy: 'unbekannt',
    chestZoneContract: 'flat',
  },
  {
    id: 'body-hochbetagt-divers',
    ageGroup: 'hochbetagt',
    genitalAnatomy: 'unbekannt',
    chestAnatomy: 'unbekannt',
    chestZoneContract: 'flat',
  },
  {
    id: 'body-erwachsener-divers-penis-brueste',
    ageGroup: 'erwachsener',
    genitalAnatomy: 'penis',
    chestAnatomy: 'brueste',
    chestZoneContract: 'breasts',
  },
  {
    id: 'body-erwachsener-divers-penis-keine-brueste',
    ageGroup: 'erwachsener',
    genitalAnatomy: 'penis',
    chestAnatomy: 'keine_brueste',
    chestZoneContract: 'flat',
  },
  {
    id: 'body-erwachsener-divers-vulva-brueste',
    ageGroup: 'erwachsener',
    genitalAnatomy: 'vulva',
    chestAnatomy: 'brueste',
    chestZoneContract: 'breasts',
  },
  {
    id: 'body-erwachsener-divers-vulva-keine-brueste',
    ageGroup: 'erwachsener',
    genitalAnatomy: 'vulva',
    chestAnatomy: 'keine_brueste',
    chestZoneContract: 'flat',
  },
  {
    id: 'body-erwachsener-divers-unbekannt-brueste',
    ageGroup: 'erwachsener',
    genitalAnatomy: 'unbekannt',
    chestAnatomy: 'brueste',
    chestZoneContract: 'breasts',
  },
  {
    id: 'body-erwachsener-divers-unbekannt-keine-brueste',
    ageGroup: 'erwachsener',
    genitalAnatomy: 'unbekannt',
    chestAnatomy: 'keine_brueste',
    chestZoneContract: 'flat',
  },
].map((configuration) => ({
  ...configuration,
  fileName: `${configuration.id}-v2.glb`,
  profile:
    configuration.ageGroup === 'erwachsener'
      ? ADULT_PROFILE
      : AGE_PROFILES[configuration.ageGroup],
}));

export function unclassifiedGenitalParts() {
  return [
    {
      zoneId: 'surface-pubic-region-unclassified',
      clinicalLabel: 'Genital-/Schambereich – Anatomie nicht klassifiziert',
      geometry: ellipsoidGeometry([0, 1.006, 0.101], [0.073, 0.058, 0.027], {
        longitudeSegments: 22,
        latitudeSegments: 14,
        frontBias: 0.06,
      }),
    },
    {
      zoneId: 'surface-genital-observation-deferred',
      clinicalLabel: 'Genitalanatomie – Untersuchung oder Angabe ausstehend',
      material: 5,
      geometry: ellipsoidGeometry([0, 0.953, 0.12], [0.042, 0.048, 0.012], {
        longitudeSegments: 20,
        latitudeSegments: 13,
      }),
    },
  ];
}

function configurationFor(variantId) {
  const configuration = DIVERS_REFERENCE_VARIANTS.find(
    (entry) => entry.id === variantId,
  );
  if (!configuration) throw new Error(`Unbekannte Divers-Referenzvariante: ${variantId}`);
  return configuration;
}

function modularAdultParts(configuration) {
  let parts = buildAdultMaleReferenceParts();

  if (configuration.genitalAnatomy !== 'penis') {
    parts = parts.filter((part) => !MALE_INTIMATE_ZONES.has(part.zoneId));
    parts = [
      ...parts,
      ...(configuration.genitalAnatomy === 'vulva'
        ? vulvaParts()
        : unclassifiedGenitalParts()),
    ];
  }

  if (configuration.chestAnatomy === 'brueste') {
    parts = parts.filter((part) => !FLAT_CHEST_ZONES.has(part.zoneId));
    parts = [...parts, ...breastParts()];
  }

  return parts;
}

export function buildDiversReferenceParts(variantId) {
  const configuration = configurationFor(variantId);
  const parts = modularAdultParts(configuration);
  return configuration.ageGroup === 'erwachsener'
    ? parts
    : buildAgeTransformedParts(parts, configuration.ageGroup);
}

export function requiredZonesForDiversReference(variantId, manifest) {
  const configuration = configurationFor(variantId);
  const anatomyZones =
    manifest.requiredAnatomyZones[configuration.genitalAnatomy] ?? [];
  const chestZones =
    manifest.requiredChestZones[configuration.chestZoneContract] ?? [];
  return [...manifest.requiredCoreZones, ...anatomyZones, ...chestZones];
}

export function buildDiversReferenceGlb(variantId) {
  const configuration = configurationFor(variantId);
  const pediatric = ['baby', 'kleinkind', 'kind'].includes(configuration.ageGroup);
  const adolescent = configuration.ageGroup === 'jugendlicher';
  const geriatric = ['senior', 'hochbetagt'].includes(configuration.ageGroup);
  return buildBodyMapReferenceGlb({
    parts: withClinicalVisualSurface(buildDiversReferenceParts(variantId), variantId),
    variantId,
    generator: `CareSuite Self-Developed ${configuration.profile.label} Divers Modular Reference Mesh Generator`,
    sceneName: `${configuration.ageGroup}-divers-${configuration.genitalAnatomy}-${configuration.chestAnatomy}-technical-reference`,
    anatomicalScope: [
      'full-body-surface',
      'face',
      'eyes',
      'ears',
      'mouth',
      'hands',
      'feet',
      'buttocks',
      `${configuration.genitalAnatomy}-external-genital-configuration`,
      `${configuration.chestAnatomy}-chest-configuration`,
      'pressure-injury-risk-surfaces',
      'continuous-visual-skin-surface',
      'transparent-anatomical-hit-proxies',
    ],
    metadataExtras: {
      ageGroup: configuration.ageGroup,
      ageGroupLabel: configuration.profile.label,
      sexPhenotype: 'divers',
      genitalAnatomy: configuration.genitalAnatomy,
      chestAnatomy: configuration.chestAnatomy,
      anatomyConfigurationExplicit:
        configuration.id !== `body-${configuration.ageGroup}-divers`,
      developmentalStage: configuration.profile.developmentalStage,
      pediatricReference: pediatric,
      pediatricAnatomyReviewed: false,
      adolescentReference: adolescent,
      adolescentAnatomyReviewed: adolescent ? false : undefined,
      geriatricAnatomyReviewed: geriatric ? false : undefined,
      intimateAnatomyReviewed: false,
      nominalHeightMeters: configuration.profile.nominalHeightMeters,
      visualSurfaceVersion: 3,
      continuousClinicalSurface: true,
      referenceInspiration: 'user-supplied-four-view-proportion-boards',
    },
  });
}
