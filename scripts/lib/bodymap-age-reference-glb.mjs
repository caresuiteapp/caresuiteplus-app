import {
  buildAdultMaleReferenceParts,
  buildBodyMapReferenceGlb,
} from './bodymap-adult-male-reference-glb.mjs';
import {
  buildAdultFemaleReferenceParts,
  vulvaParts,
} from './bodymap-adult-female-reference-glb.mjs';

const SOURCE_HEIGHT = 1.72;
const SOURCE_LANDMARKS = [0, 0.12, 0.625, 1.035, 1.405, SOURCE_HEIGHT];
const MALE_INTIMATE_ZONES = new Set([
  'surface-penis',
  'surface-glans',
  'surface-urethral-opening-penis',
  'surface-scrotum-left',
  'surface-scrotum-right',
]);

export const AGE_PROFILES = {
  'junger-erwachsener': {
    label: 'Junger Erwachsener',
    nominalHeightMeters: 1.72,
    landmarks: [0, 0.12, 0.62, 1.03, 1.4, 1.72],
    headScale: 1.01,
    torsoScale: 0.97,
    pelvisScale: 0.97,
    limbScale: 0.96,
    handFootScale: 0.95,
    intimateScale: 0.94,
    developmentalStage: 'postpubertal-young-adult',
  },
  kind: {
    label: 'Kind',
    nominalHeightMeters: 1.42,
    landmarks: [0, 0.1, 0.48, 0.78, 1.1, 1.42],
    headScale: 1.2,
    torsoScale: 0.93,
    pelvisScale: 0.92,
    limbScale: 0.9,
    handFootScale: 0.88,
    intimateScale: 0.62,
    developmentalStage: 'prepubertal-child',
  },
  kleinkind: {
    label: 'Kleinkind',
    nominalHeightMeters: 1,
    landmarks: [0, 0.075, 0.31, 0.53, 0.74, 1],
    headScale: 1.48,
    torsoScale: 1.02,
    pelvisScale: 1,
    limbScale: 0.88,
    handFootScale: 0.82,
    intimateScale: 0.48,
    developmentalStage: 'prepubertal-toddler',
  },
  baby: {
    label: 'Baby',
    nominalHeightMeters: 0.68,
    landmarks: [0, 0.045, 0.18, 0.31, 0.46, 0.68],
    headScale: 1.72,
    torsoScale: 1.12,
    pelvisScale: 1.08,
    limbScale: 0.82,
    handFootScale: 0.76,
    intimateScale: 0.38,
    developmentalStage: 'infant',
  },
};

export const AGE_REFERENCE_VARIANTS = [
  ...['junger-erwachsener', 'kind', 'kleinkind', 'baby'].flatMap((ageGroup) =>
    ['maennlich', 'weiblich'].map((sex) => ({
      id: `body-${ageGroup}-${sex}`,
      ageGroup,
      sex,
      fileName: `body-${ageGroup}-${sex}-v2.glb`,
      profile: AGE_PROFILES[ageGroup],
      chestZoneContract:
        sex === 'weiblich'
          ? ageGroup === 'junger-erwachsener'
            ? 'breasts'
            : 'prepubertal'
          : null,
    })),
  ),
];

function isHeadZone(zoneId) {
  return [
    'scalp',
    'face',
    'occiput',
    'nose',
    'lip',
    'chin',
    'eye',
    'iris',
    'pupil',
    'ear',
  ].some((token) => zoneId.includes(token));
}

function isTorsoZone(zoneId) {
  return [
    'neck',
    'chest',
    'pectoral',
    'breast',
    'areola',
    'nipple',
    'abdomen',
    'navel',
    'clavicle',
    'scapula',
    'thoracic',
    'lumbar',
  ].some((token) => zoneId.includes(token));
}

function isPelvisZone(zoneId) {
  return [
    'pelvis',
    'sacrum',
    'coccyx',
    'buttock',
    'ischial',
    'perineum',
    'anus',
  ].some((token) => zoneId.includes(token));
}

function isHandFootZone(zoneId) {
  return [
    'hand',
    'finger',
    'thumb',
    'wrist',
    'foot',
    'sole',
    'heel',
    'toe',
    'malleolus',
  ].some((token) => zoneId.includes(token));
}

function isIntimateZone(zoneId) {
  return [
    'penis',
    'glans',
    'scrotum',
    'mons-pubis',
    'labium',
    'clitoral',
    'urethral-opening',
    'vaginal-opening',
  ].some((token) => zoneId.includes(token));
}

function mapHeight(sourceY, targetLandmarks) {
  const clamped = Math.max(0, Math.min(SOURCE_HEIGHT, sourceY));
  for (let index = 0; index < SOURCE_LANDMARKS.length - 1; index += 1) {
    const sourceStart = SOURCE_LANDMARKS[index];
    const sourceEnd = SOURCE_LANDMARKS[index + 1];
    if (clamped <= sourceEnd || index === SOURCE_LANDMARKS.length - 2) {
      const progress = (clamped - sourceStart) / Math.max(sourceEnd - sourceStart, 0.0001);
      return (
        targetLandmarks[index] +
        progress * (targetLandmarks[index + 1] - targetLandmarks[index])
      );
    }
  }
  return targetLandmarks[targetLandmarks.length - 1];
}

function lateralScale(zoneId, profile) {
  const globalScale = profile.nominalHeightMeters / SOURCE_HEIGHT;
  if (isIntimateZone(zoneId)) return globalScale * profile.intimateScale;
  if (isHeadZone(zoneId)) return globalScale * profile.headScale;
  if (isHandFootZone(zoneId)) return globalScale * profile.handFootScale;
  if (isPelvisZone(zoneId)) return globalScale * profile.pelvisScale;
  if (isTorsoZone(zoneId)) return globalScale * profile.torsoScale;
  return globalScale * profile.limbScale;
}

function depthScale(zoneId, profile) {
  const base = lateralScale(zoneId, profile);
  if (isHeadZone(zoneId)) return base * 1.03;
  if (isTorsoZone(zoneId) && profile.developmentalStage === 'infant') return base * 1.12;
  return base;
}

export function transformAgeReferenceGeometry(geometry, zoneId, profile) {
  const positions = new Float32Array(geometry.positions.length);
  const normals = new Float32Array(geometry.normals.length);
  const scaleX = lateralScale(zoneId, profile);
  const scaleZ = depthScale(zoneId, profile);

  for (let index = 0; index < geometry.positions.length; index += 3) {
    positions[index] = geometry.positions[index] * scaleX;
    positions[index + 1] = mapHeight(geometry.positions[index + 1], profile.landmarks);
    positions[index + 2] = geometry.positions[index + 2] * scaleZ;

    const sourceY = geometry.positions[index + 1];
    const epsilon = 0.0005;
    const localScaleY =
      (mapHeight(sourceY + epsilon, profile.landmarks) -
        mapHeight(sourceY - epsilon, profile.landmarks)) /
      (2 * epsilon);
    const normalX = geometry.normals[index] / Math.max(scaleX, 0.0001);
    const normalY = geometry.normals[index + 1] / Math.max(localScaleY, 0.0001);
    const normalZ = geometry.normals[index + 2] / Math.max(scaleZ, 0.0001);
    const length = Math.hypot(normalX, normalY, normalZ) || 1;
    normals[index] = normalX / length;
    normals[index + 1] = normalY / length;
    normals[index + 2] = normalZ / length;
  }

  return {
    positions,
    normals,
    uvs: new Float32Array(geometry.uvs),
    indices: new Uint16Array(geometry.indices),
  };
}

function sourcePartsForVariant(configuration) {
  if (configuration.sex === 'maennlich') return buildAdultMaleReferenceParts();
  if (configuration.ageGroup === 'junger-erwachsener') {
    return buildAdultFemaleReferenceParts();
  }
  return [
    ...buildAdultMaleReferenceParts().filter(
      (part) => !MALE_INTIMATE_ZONES.has(part.zoneId),
    ),
    ...vulvaParts(),
  ];
}

function configurationFor(variantId) {
  const configuration = AGE_REFERENCE_VARIANTS.find((entry) => entry.id === variantId);
  if (!configuration) throw new Error(`Unbekannte Altersreferenzvariante: ${variantId}`);
  return configuration;
}

export function buildAgeReferenceParts(variantId) {
  const configuration = configurationFor(variantId);
  return sourcePartsForVariant(configuration).map((part) => ({
    ...part,
    geometry: transformAgeReferenceGeometry(part.geometry, part.zoneId, configuration.profile),
  }));
}

export function buildAgeTransformedParts(parts, ageGroup) {
  const profile = AGE_PROFILES[ageGroup];
  if (!profile) throw new Error(`Unbekannte Altersgruppe: ${ageGroup}`);
  return parts.map((part) => ({
    ...part,
    geometry: transformAgeReferenceGeometry(part.geometry, part.zoneId, profile),
  }));
}

export function requiredZonesForAgeReference(variantId, manifest) {
  const configuration = configurationFor(variantId);
  const anatomyZones =
    configuration.sex === 'maennlich'
      ? manifest.requiredAnatomyZones.penis
      : manifest.requiredAnatomyZones.vulva;
  const chestZones = configuration.chestZoneContract
    ? manifest.requiredChestZones[configuration.chestZoneContract]
    : [];
  return [...manifest.requiredCoreZones, ...anatomyZones, ...chestZones];
}

export function buildAgeReferenceGlb(variantId) {
  const configuration = configurationFor(variantId);
  const pediatric = configuration.ageGroup !== 'junger-erwachsener';
  const chestScope =
    configuration.chestZoneContract === 'breasts'
      ? ['breasts']
      : configuration.chestZoneContract === 'prepubertal'
        ? ['prepubertal-chest']
        : [];
  return buildBodyMapReferenceGlb({
    parts: buildAgeReferenceParts(variantId),
    variantId,
    generator: `CareSuite Self-Developed ${configuration.profile.label} ${configuration.sex} Reference Mesh Generator`,
    sceneName: `${configuration.ageGroup}-${configuration.sex}-technical-reference`,
    anatomicalScope: [
      'full-body-surface',
      'face',
      'eyes',
      'ears',
      'mouth',
      'hands',
      'feet',
      'buttocks',
      configuration.sex === 'maennlich'
        ? 'male-external-genitalia'
        : 'female-external-genitalia',
      ...chestScope,
      'pressure-injury-risk-surfaces',
    ],
    metadataExtras: {
      ageGroup: configuration.ageGroup,
      ageGroupLabel: configuration.profile.label,
      sexPhenotype: configuration.sex,
      developmentalStage: configuration.profile.developmentalStage,
      pediatricReference: pediatric,
      pediatricAnatomyReviewed: false,
      prepubertalChest: configuration.chestZoneContract === 'prepubertal',
      nominalHeightMeters: configuration.profile.nominalHeightMeters,
    },
  });
}
