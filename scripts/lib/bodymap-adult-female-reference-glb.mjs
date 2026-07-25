import {
  buildAdultMaleReferenceParts,
  buildBodyMapReferenceGlb,
  ellipsoidGeometry,
} from './bodymap-adult-male-reference-glb.mjs';

const EXCLUDED_MALE_ZONES = new Set([
  'surface-pectoral-left',
  'surface-pectoral-right',
  'surface-nipple-left',
  'surface-nipple-right',
  'surface-penis',
  'surface-glans',
  'surface-urethral-opening-penis',
  'surface-scrotum-left',
  'surface-scrotum-right',
]);

function scaleProfileForZone(zoneId) {
  if (
    zoneId.includes('pelvis') ||
    zoneId.includes('buttock') ||
    zoneId.includes('ischial') ||
    zoneId.includes('thigh')
  ) {
    return [1.09, 1, 1.06];
  }
  if (
    zoneId.includes('shoulder') ||
    zoneId.includes('clavicle') ||
    zoneId.includes('scapula') ||
    zoneId.includes('upper-arm') ||
    zoneId.includes('elbow') ||
    zoneId.includes('forearm') ||
    zoneId.includes('wrist') ||
    zoneId.includes('hand') ||
    zoneId.includes('finger')
  ) {
    return [0.92, 1, 0.94];
  }
  if (zoneId.includes('chest') || zoneId.includes('thoracic')) {
    return [0.93, 1, 0.96];
  }
  if (zoneId.includes('abdomen') || zoneId.includes('lumbar')) {
    return [0.92, 1, 0.98];
  }
  if (zoneId.includes('neck')) return [0.92, 1, 0.95];
  if (
    zoneId.includes('scalp') ||
    zoneId.includes('face') ||
    zoneId.includes('occiput') ||
    zoneId.includes('nose') ||
    zoneId.includes('lip') ||
    zoneId.includes('chin') ||
    zoneId.includes('eye') ||
    zoneId.includes('iris') ||
    zoneId.includes('pupil') ||
    zoneId.includes('ear')
  ) {
    return [0.96, 1, 0.98];
  }
  if (
    zoneId.includes('lower-leg') ||
    zoneId.includes('calf') ||
    zoneId.includes('malleolus') ||
    zoneId.includes('foot') ||
    zoneId.includes('sole') ||
    zoneId.includes('heel') ||
    zoneId.includes('toe')
  ) {
    return [1.02, 1, 0.99];
  }
  return [1, 1, 1];
}

function scaledGeometry(geometry, [scaleX, scaleY, scaleZ]) {
  const positions = new Float32Array(geometry.positions.length);
  const normals = new Float32Array(geometry.normals.length);
  for (let index = 0; index < geometry.positions.length; index += 3) {
    positions[index] = geometry.positions[index] * scaleX;
    positions[index + 1] = geometry.positions[index + 1] * scaleY;
    positions[index + 2] = geometry.positions[index + 2] * scaleZ;

    const normalX = geometry.normals[index] / scaleX;
    const normalY = geometry.normals[index + 1] / scaleY;
    const normalZ = geometry.normals[index + 2] / scaleZ;
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

export function breastParts() {
  return [-1, 1].flatMap((side) => {
    const sideId = side === -1 ? 'left' : 'right';
    const sideLabel = side === -1 ? 'links' : 'rechts';
    const x = side * 0.082;
    return [
      {
        zoneId: `surface-breast-${sideId}`,
        clinicalLabel: `Brust ${sideLabel}`,
        geometry: ellipsoidGeometry([x, 1.35, 0.105], [0.082, 0.076, 0.054], {
          longitudeSegments: 26,
          latitudeSegments: 17,
          frontBias: 0.16,
        }),
      },
      {
        zoneId: `surface-areola-${sideId}`,
        clinicalLabel: `Warzenhof ${sideLabel}`,
        material: 1,
        geometry: ellipsoidGeometry([x, 1.345, 0.166], [0.022, 0.022, 0.005], {
          longitudeSegments: 18,
          latitudeSegments: 11,
        }),
      },
      {
        zoneId: `surface-nipple-${sideId}`,
        clinicalLabel: `Brustwarze ${sideLabel}`,
        material: 1,
        geometry: ellipsoidGeometry([x, 1.345, 0.173], [0.009, 0.009, 0.007], {
          longitudeSegments: 14,
          latitudeSegments: 9,
        }),
      },
    ];
  });
}

export function vulvaParts() {
  return [
    {
      zoneId: 'surface-mons-pubis',
      clinicalLabel: 'Venushügel',
      geometry: ellipsoidGeometry([0, 1.015, 0.095], [0.073, 0.052, 0.032], {
        longitudeSegments: 22,
        latitudeSegments: 14,
        frontBias: 0.08,
      }),
    },
    {
      zoneId: 'surface-labium-majus-left',
      clinicalLabel: 'Große Schamlippe links',
      geometry: ellipsoidGeometry([-0.019, 0.963, 0.116], [0.019, 0.052, 0.018], {
        longitudeSegments: 20,
        latitudeSegments: 13,
      }),
    },
    {
      zoneId: 'surface-labium-majus-right',
      clinicalLabel: 'Große Schamlippe rechts',
      geometry: ellipsoidGeometry([0.019, 0.963, 0.116], [0.019, 0.052, 0.018], {
        longitudeSegments: 20,
        latitudeSegments: 13,
      }),
    },
    {
      zoneId: 'surface-labium-minus-left',
      clinicalLabel: 'Kleine Schamlippe links',
      material: 1,
      geometry: ellipsoidGeometry([-0.009, 0.958, 0.137], [0.009, 0.038, 0.009], {
        longitudeSegments: 18,
        latitudeSegments: 12,
      }),
    },
    {
      zoneId: 'surface-labium-minus-right',
      clinicalLabel: 'Kleine Schamlippe rechts',
      material: 1,
      geometry: ellipsoidGeometry([0.009, 0.958, 0.137], [0.009, 0.038, 0.009], {
        longitudeSegments: 18,
        latitudeSegments: 12,
      }),
    },
    {
      zoneId: 'surface-clitoral-region',
      clinicalLabel: 'Klitorisregion',
      material: 1,
      geometry: ellipsoidGeometry([0, 0.998, 0.145], [0.008, 0.009, 0.007], {
        longitudeSegments: 14,
        latitudeSegments: 9,
      }),
    },
    {
      zoneId: 'surface-urethral-opening-vulva',
      clinicalLabel: 'Harnröhrenöffnung Vulva',
      material: 4,
      geometry: ellipsoidGeometry([0, 0.972, 0.147], [0.0035, 0.005, 0.0025], {
        longitudeSegments: 10,
        latitudeSegments: 7,
      }),
    },
    {
      zoneId: 'surface-vaginal-opening',
      clinicalLabel: 'Vaginalöffnung',
      material: 1,
      geometry: ellipsoidGeometry([0, 0.934, 0.143], [0.012, 0.022, 0.006], {
        longitudeSegments: 16,
        latitudeSegments: 10,
      }),
    },
  ];
}

export function buildAdultFemaleReferenceParts() {
  const inheritedParts = buildAdultMaleReferenceParts()
    .filter((part) => !EXCLUDED_MALE_ZONES.has(part.zoneId))
    .map((part) => ({
      ...part,
      geometry: scaledGeometry(part.geometry, scaleProfileForZone(part.zoneId)),
    }));
  return [...inheritedParts, ...breastParts(), ...vulvaParts()];
}

export function buildAdultFemaleReferenceGlb() {
  return buildBodyMapReferenceGlb({
    parts: buildAdultFemaleReferenceParts(),
    variantId: 'body-erwachsener-weiblich',
    generator: 'CareSuite Self-Developed Adult Female Reference Mesh Generator',
    sceneName: 'adult-female-technical-reference',
    anatomicalScope: [
      'full-body-surface',
      'face',
      'eyes',
      'ears',
      'mouth',
      'hands',
      'feet',
      'breasts',
      'buttocks',
      'female-external-genitalia',
      'pressure-injury-risk-surfaces',
    ],
  });
}
