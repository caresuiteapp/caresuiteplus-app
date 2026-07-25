const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function bytesOf(view) {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}

function pad4(buffer, fill = 0) {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding, fill)]) : buffer;
}

function normalize([x, y, z]) {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function addScaled(origin, xAxis, x, yAxis, y, zAxis, z) {
  return [
    origin[0] + xAxis[0] * x + yAxis[0] * y + zAxis[0] * z,
    origin[1] + xAxis[1] * x + yAxis[1] * y + zAxis[1] * z,
    origin[2] + xAxis[2] * x + yAxis[2] * y + zAxis[2] * z,
  ];
}

function boundsOf(positions) {
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[index + axis]);
      max[axis] = Math.max(max[axis], positions[index + axis]);
    }
  }
  return { min, max };
}

function ellipsoidGeometry(
  center,
  radii,
  {
    longitudeSegments = 24,
    latitudeSegments = 16,
    rotationY = 0,
    frontBias = 0,
  } = {},
) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);

  for (let latitude = 0; latitude <= latitudeSegments; latitude += 1) {
    const v = latitude / latitudeSegments;
    const phi = v * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    for (let longitude = 0; longitude <= longitudeSegments; longitude += 1) {
      const u = longitude / longitudeSegments;
      const theta = u * Math.PI * 2;
      const unitX = Math.cos(theta) * sinPhi;
      const unitY = cosPhi;
      const unitZ = Math.sin(theta) * sinPhi;
      const biasedZ = unitZ >= 0 ? unitZ * (1 + frontBias) : unitZ;
      const localX = unitX * radii[0];
      const localY = unitY * radii[1];
      const localZ = biasedZ * radii[2];
      positions.push(
        center[0] + localX * cosY + localZ * sinY,
        center[1] + localY,
        center[2] - localX * sinY + localZ * cosY,
      );
      const localNormal = normalize([
        unitX / Math.max(radii[0], 0.0001),
        unitY / Math.max(radii[1], 0.0001),
        biasedZ / Math.max(radii[2], 0.0001),
      ]);
      normals.push(
        localNormal[0] * cosY + localNormal[2] * sinY,
        localNormal[1],
        -localNormal[0] * sinY + localNormal[2] * cosY,
      );
      uvs.push(u, 1 - v);
    }
  }

  const stride = longitudeSegments + 1;
  for (let latitude = 0; latitude < latitudeSegments; latitude += 1) {
    for (let longitude = 0; longitude < longitudeSegments; longitude += 1) {
      const a = latitude * stride + longitude;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

function capsuleGeometry(
  start,
  end,
  radius,
  { radialSegments = 20, capSegments = 6, radiusX = radius, radiusZ = radius } = {},
) {
  const direction = subtract(end, start);
  const cylinderLength = Math.hypot(...direction);
  const yAxis = normalize(direction);
  const reference = Math.abs(yAxis[1]) > 0.94 ? [1, 0, 0] : [0, 1, 0];
  const xAxis = normalize(cross(reference, yAxis));
  const zAxis = normalize(cross(yAxis, xAxis));
  const center = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ];
  const half = cylinderLength / 2;
  const rings = [];
  for (let segment = 0; segment <= capSegments; segment += 1) {
    const angle = -Math.PI / 2 + (segment / capSegments) * (Math.PI / 2);
    rings.push({
      y: -half + Math.sin(angle) * radius,
      ringX: Math.cos(angle) * radiusX,
      ringZ: Math.cos(angle) * radiusZ,
      normalY: Math.sin(angle),
      normalRadius: Math.cos(angle),
    });
  }
  for (let segment = 0; segment <= capSegments; segment += 1) {
    const angle = (segment / capSegments) * (Math.PI / 2);
    rings.push({
      y: half + Math.sin(angle) * radius,
      ringX: Math.cos(angle) * radiusX,
      ringZ: Math.cos(angle) * radiusZ,
      normalY: Math.sin(angle),
      normalRadius: Math.cos(angle),
    });
  }

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (const [ringIndex, ring] of rings.entries()) {
    for (let radial = 0; radial <= radialSegments; radial += 1) {
      const u = radial / radialSegments;
      const angle = u * Math.PI * 2;
      const x = Math.cos(angle) * ring.ringX;
      const z = Math.sin(angle) * ring.ringZ;
      positions.push(...addScaled(center, xAxis, x, yAxis, ring.y, zAxis, z));
      const radialNormal = normalize([
        Math.cos(angle) * ring.normalRadius * (radius / Math.max(radiusX, 0.0001)),
        ring.normalY,
        Math.sin(angle) * ring.normalRadius * (radius / Math.max(radiusZ, 0.0001)),
      ]);
      normals.push(
        xAxis[0] * radialNormal[0] +
          yAxis[0] * radialNormal[1] +
          zAxis[0] * radialNormal[2],
        xAxis[1] * radialNormal[0] +
          yAxis[1] * radialNormal[1] +
          zAxis[1] * radialNormal[2],
        xAxis[2] * radialNormal[0] +
          yAxis[2] * radialNormal[1] +
          zAxis[2] * radialNormal[2],
      );
      uvs.push(u, 1 - ringIndex / Math.max(rings.length - 1, 1));
    }
  }

  const stride = radialSegments + 1;
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const a = ring * stride + radial;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

function materialDefinitions() {
  return [
    {
      name: 'skin_body',
      extras: { bodymapSkinMaterial: true, materialRole: 'skin' },
      pbrMetallicRoughness: {
        baseColorFactor: [0.725, 0.471, 0.333, 1],
        metallicFactor: 0,
        roughnessFactor: 0.64,
      },
    },
    {
      name: 'mucosa_clinical',
      extras: { materialRole: 'mucosa', bodymapSkinMaterial: false },
      pbrMetallicRoughness: {
        baseColorFactor: [0.56, 0.19, 0.22, 1],
        metallicFactor: 0,
        roughnessFactor: 0.54,
      },
    },
    {
      name: 'eye_sclera',
      extras: { materialRole: 'sclera', bodymapSkinMaterial: false },
      pbrMetallicRoughness: {
        baseColorFactor: [0.91, 0.91, 0.86, 1],
        metallicFactor: 0,
        roughnessFactor: 0.3,
      },
    },
    {
      name: 'eye_iris',
      extras: { materialRole: 'iris', bodymapSkinMaterial: false },
      pbrMetallicRoughness: {
        baseColorFactor: [0.12, 0.28, 0.32, 1],
        metallicFactor: 0,
        roughnessFactor: 0.35,
      },
    },
    {
      name: 'eye_pupil',
      extras: { materialRole: 'pupil', bodymapSkinMaterial: false },
      pbrMetallicRoughness: {
        baseColorFactor: [0.015, 0.012, 0.012, 1],
        metallicFactor: 0,
        roughnessFactor: 0.28,
      },
    },
    {
      name: 'nail_keratin',
      extras: { materialRole: 'nail', bodymapSkinMaterial: false },
      pbrMetallicRoughness: {
        baseColorFactor: [0.79, 0.55, 0.47, 1],
        metallicFactor: 0,
        roughnessFactor: 0.52,
      },
    },
  ];
}

function sideName(side) {
  return side === -1 ? 'left' : 'right';
}

function sideLabel(side) {
  return side === -1 ? 'links' : 'rechts';
}

function addHand(parts, side) {
  const sideId = sideName(side);
  const x = side * 0.37;
  parts.push({
    zoneId: `surface-hand-${sideId}`,
    clinicalLabel: `Handfläche ${sideLabel(side)}`,
    geometry: ellipsoidGeometry([x, 0.805, 0.018], [0.038, 0.061, 0.022], {
      longitudeSegments: 24,
      latitudeSegments: 14,
    }),
  });
  const fingers = [
    { id: 'thumb', dx: -side * 0.038, length: 0.052, z: 0.02 },
    { id: 'index-finger', dx: -side * 0.023, length: 0.063, z: 0.012 },
    { id: 'middle-finger', dx: -side * 0.008, length: 0.069, z: 0.01 },
    { id: 'ring-finger', dx: side * 0.008, length: 0.064, z: 0.01 },
    { id: 'little-finger', dx: side * 0.023, length: 0.053, z: 0.012 },
  ];
  for (const [index, finger] of fingers.entries()) {
    const fingerX = x + finger.dx;
    const fingerTop = 0.772 - index * 0.001;
    parts.push({
      zoneId: `surface-${finger.id}-${sideId}`,
      clinicalLabel: `${finger.id} ${sideLabel(side)}`,
      geometry: capsuleGeometry(
        [fingerX, fingerTop, finger.z],
        [fingerX + (finger.id === 'thumb' ? -side * 0.018 : 0), fingerTop - finger.length, finger.z],
        finger.id === 'thumb' ? 0.011 : 0.008,
        { radialSegments: 14, capSegments: 4 },
      ),
    });
    parts.push({
      zoneId: `surface-${finger.id}-nail-${sideId}`,
      clinicalLabel: `Nagel ${finger.id} ${sideLabel(side)}`,
      material: 5,
      geometry: ellipsoidGeometry(
        [
          fingerX + (finger.id === 'thumb' ? -side * 0.018 : 0),
          fingerTop - finger.length + 0.004,
          finger.z + 0.007,
        ],
        [0.006, 0.009, 0.003],
        { longitudeSegments: 12, latitudeSegments: 8 },
      ),
    });
  }
}

function addFoot(parts, side) {
  const sideId = sideName(side);
  const x = side * 0.105;
  parts.push({
    zoneId: `surface-foot-${sideId}`,
    clinicalLabel: `Fußrücken ${sideLabel(side)}`,
    geometry: ellipsoidGeometry([x, 0.05, 0.055], [0.066, 0.046, 0.145], {
      longitudeSegments: 28,
      latitudeSegments: 16,
      frontBias: 0.12,
    }),
  });
  parts.push({
    zoneId: `surface-sole-${sideId}`,
    clinicalLabel: `Fußsohle ${sideLabel(side)}`,
    geometry: ellipsoidGeometry([x, 0.012, 0.055], [0.06, 0.01, 0.13], {
      longitudeSegments: 20,
      latitudeSegments: 10,
    }),
  });
  parts.push({
    zoneId: `surface-heel-${sideId}`,
    clinicalLabel: `Ferse ${sideLabel(side)}`,
    geometry: ellipsoidGeometry([x, 0.048, -0.06], [0.057, 0.047, 0.052], {
      longitudeSegments: 20,
      latitudeSegments: 12,
    }),
  });
  const toes = [
    { id: 'great-toe', dx: -side * 0.024, radius: 0.02, z: 0.188 },
    { id: 'second-toe', dx: -side * 0.009, radius: 0.016, z: 0.192 },
    { id: 'third-toe', dx: side * 0.006, radius: 0.014, z: 0.189 },
    { id: 'fourth-toe', dx: side * 0.019, radius: 0.012, z: 0.183 },
    { id: 'little-toe', dx: side * 0.031, radius: 0.01, z: 0.174 },
  ];
  for (const toe of toes) {
    parts.push({
      zoneId: `surface-${toe.id}-${sideId}`,
      clinicalLabel: `${toe.id} ${sideLabel(side)}`,
      geometry: ellipsoidGeometry(
        [x + toe.dx, toe.radius * 1.15, toe.z],
        [toe.radius, toe.radius * 0.78, toe.radius * 1.25],
        { longitudeSegments: 14, latitudeSegments: 9 },
      ),
    });
    parts.push({
      zoneId: `surface-${toe.id}-nail-${sideId}`,
      clinicalLabel: `Zehennagel ${toe.id} ${sideLabel(side)}`,
      material: 5,
      geometry: ellipsoidGeometry(
        [x + toe.dx, toe.radius * 1.62, toe.z + toe.radius * 0.18],
        [toe.radius * 0.65, 0.004, toe.radius * 0.75],
        { longitudeSegments: 12, latitudeSegments: 7 },
      ),
    });
  }
}

export function buildAdultMaleReferenceParts() {
  const parts = [
    {
      zoneId: 'surface-scalp',
      clinicalLabel: 'Kopfhaut',
      geometry: ellipsoidGeometry([0, 1.615, 0], [0.104, 0.105, 0.092], {
        longitudeSegments: 32,
        latitudeSegments: 22,
        frontBias: 0.08,
      }),
    },
    {
      zoneId: 'surface-face',
      clinicalLabel: 'Gesicht',
      geometry: ellipsoidGeometry([0, 1.595, 0.052], [0.086, 0.088, 0.052], {
        longitudeSegments: 28,
        latitudeSegments: 18,
        frontBias: 0.16,
      }),
    },
    {
      zoneId: 'surface-occiput',
      clinicalLabel: 'Hinterhaupt',
      geometry: ellipsoidGeometry([0, 1.635, -0.078], [0.066, 0.07, 0.018], {
        longitudeSegments: 18,
        latitudeSegments: 12,
      }),
    },
    {
      zoneId: 'surface-nose',
      clinicalLabel: 'Nase',
      geometry: capsuleGeometry([0, 1.62, 0.105], [0, 1.575, 0.123], 0.015, {
        radialSegments: 16,
        capSegments: 5,
        radiusX: 0.017,
        radiusZ: 0.013,
      }),
    },
    {
      zoneId: 'surface-upper-lip',
      clinicalLabel: 'Oberlippe',
      material: 1,
      geometry: capsuleGeometry([-0.027, 1.558, 0.105], [0.027, 1.558, 0.105], 0.007, {
        radialSegments: 16,
        capSegments: 4,
        radiusX: 0.006,
        radiusZ: 0.005,
      }),
    },
    {
      zoneId: 'surface-lower-lip',
      clinicalLabel: 'Unterlippe',
      material: 1,
      geometry: capsuleGeometry([-0.026, 1.547, 0.104], [0.026, 1.547, 0.104], 0.0075, {
        radialSegments: 16,
        capSegments: 4,
        radiusX: 0.0065,
        radiusZ: 0.005,
      }),
    },
    {
      zoneId: 'surface-chin',
      clinicalLabel: 'Kinn',
      geometry: ellipsoidGeometry([0, 1.518, 0.091], [0.035, 0.023, 0.015], {
        longitudeSegments: 18,
        latitudeSegments: 12,
      }),
    },
    {
      zoneId: 'surface-neck-anterior',
      clinicalLabel: 'Hals vorne',
      geometry: capsuleGeometry([0, 1.46, 0.012], [0, 1.505, 0.012], 0.058, {
        radialSegments: 24,
        capSegments: 5,
        radiusX: 0.061,
        radiusZ: 0.056,
      }),
    },
    {
      zoneId: 'surface-chest',
      clinicalLabel: 'Brustkorb',
      geometry: ellipsoidGeometry([0, 1.335, 0.004], [0.22, 0.19, 0.108], {
        longitudeSegments: 32,
        latitudeSegments: 20,
        frontBias: 0.08,
      }),
    },
    {
      zoneId: 'surface-abdomen',
      clinicalLabel: 'Bauch',
      geometry: ellipsoidGeometry([0, 1.17, 0.005], [0.168, 0.16, 0.098], {
        longitudeSegments: 30,
        latitudeSegments: 18,
        frontBias: 0.08,
      }),
    },
    {
      zoneId: 'surface-pelvis',
      clinicalLabel: 'Becken',
      geometry: ellipsoidGeometry([0, 1.035, 0], [0.16, 0.11, 0.105], {
        longitudeSegments: 30,
        latitudeSegments: 18,
      }),
    },
    {
      zoneId: 'surface-pectoral-left',
      clinicalLabel: 'Brustmuskel links',
      geometry: ellipsoidGeometry([-0.082, 1.355, 0.098], [0.076, 0.064, 0.021], {
        longitudeSegments: 20,
        latitudeSegments: 12,
      }),
    },
    {
      zoneId: 'surface-pectoral-right',
      clinicalLabel: 'Brustmuskel rechts',
      geometry: ellipsoidGeometry([0.082, 1.355, 0.098], [0.076, 0.064, 0.021], {
        longitudeSegments: 20,
        latitudeSegments: 12,
      }),
    },
    {
      zoneId: 'surface-nipple-left',
      clinicalLabel: 'Brustwarze links',
      material: 1,
      geometry: ellipsoidGeometry([-0.082, 1.35, 0.122], [0.01, 0.01, 0.005], {
        longitudeSegments: 14,
        latitudeSegments: 9,
      }),
    },
    {
      zoneId: 'surface-nipple-right',
      clinicalLabel: 'Brustwarze rechts',
      material: 1,
      geometry: ellipsoidGeometry([0.082, 1.35, 0.122], [0.01, 0.01, 0.005], {
        longitudeSegments: 14,
        latitudeSegments: 9,
      }),
    },
    {
      zoneId: 'surface-navel',
      clinicalLabel: 'Bauchnabel',
      material: 1,
      geometry: ellipsoidGeometry([0, 1.165, 0.109], [0.01, 0.012, 0.004], {
        longitudeSegments: 14,
        latitudeSegments: 9,
      }),
    },
    {
      zoneId: 'surface-thoracic-spine',
      clinicalLabel: 'Brustwirbelsäule',
      geometry: capsuleGeometry([0, 1.18, -0.118], [0, 1.415, -0.105], 0.012, {
        radialSegments: 14,
        capSegments: 4,
        radiusX: 0.013,
        radiusZ: 0.008,
      }),
    },
    {
      zoneId: 'surface-lumbar-spine',
      clinicalLabel: 'Lendenwirbelsäule',
      geometry: capsuleGeometry([0, 1.055, -0.112], [0, 1.19, -0.118], 0.013, {
        radialSegments: 14,
        capSegments: 4,
        radiusX: 0.014,
        radiusZ: 0.008,
      }),
    },
    {
      zoneId: 'surface-sacrum',
      clinicalLabel: 'Kreuzbein',
      geometry: ellipsoidGeometry([0, 1.01, -0.118], [0.048, 0.055, 0.012], {
        longitudeSegments: 18,
        latitudeSegments: 12,
      }),
    },
    {
      zoneId: 'surface-coccyx',
      clinicalLabel: 'Steißbein',
      geometry: ellipsoidGeometry([0, 0.955, -0.115], [0.022, 0.03, 0.012], {
        longitudeSegments: 16,
        latitudeSegments: 10,
      }),
    },
    {
      zoneId: 'surface-buttock-left',
      clinicalLabel: 'Gesäß links',
      geometry: ellipsoidGeometry([-0.077, 1.005, -0.08], [0.083, 0.095, 0.064], {
        longitudeSegments: 24,
        latitudeSegments: 16,
      }),
    },
    {
      zoneId: 'surface-buttock-right',
      clinicalLabel: 'Gesäß rechts',
      geometry: ellipsoidGeometry([0.077, 1.005, -0.08], [0.083, 0.095, 0.064], {
        longitudeSegments: 24,
        latitudeSegments: 16,
      }),
    },
    {
      zoneId: 'surface-ischial-left',
      clinicalLabel: 'Sitzbein links',
      geometry: ellipsoidGeometry([-0.075, 0.94, -0.075], [0.038, 0.027, 0.018], {
        longitudeSegments: 16,
        latitudeSegments: 10,
      }),
    },
    {
      zoneId: 'surface-ischial-right',
      clinicalLabel: 'Sitzbein rechts',
      geometry: ellipsoidGeometry([0.075, 0.94, -0.075], [0.038, 0.027, 0.018], {
        longitudeSegments: 16,
        latitudeSegments: 10,
      }),
    },
    {
      zoneId: 'surface-penis',
      clinicalLabel: 'Penisschaft',
      geometry: capsuleGeometry([0, 1.005, 0.12], [0, 0.925, 0.185], 0.025, {
        radialSegments: 22,
        capSegments: 6,
        radiusX: 0.026,
        radiusZ: 0.024,
      }),
    },
    {
      zoneId: 'surface-glans',
      clinicalLabel: 'Glans penis',
      material: 1,
      geometry: ellipsoidGeometry([0, 0.907, 0.2], [0.028, 0.032, 0.029], {
        longitudeSegments: 22,
        latitudeSegments: 14,
      }),
    },
    {
      zoneId: 'surface-urethral-opening-penis',
      clinicalLabel: 'Harnröhrenöffnung Penis',
      material: 4,
      geometry: ellipsoidGeometry([0, 0.9, 0.227], [0.004, 0.006, 0.003], {
        longitudeSegments: 10,
        latitudeSegments: 7,
      }),
    },
    {
      zoneId: 'surface-scrotum-left',
      clinicalLabel: 'Skrotum links',
      geometry: ellipsoidGeometry([-0.03, 0.945, 0.12], [0.037, 0.053, 0.034], {
        longitudeSegments: 22,
        latitudeSegments: 14,
      }),
    },
    {
      zoneId: 'surface-scrotum-right',
      clinicalLabel: 'Skrotum rechts',
      geometry: ellipsoidGeometry([0.03, 0.945, 0.12], [0.037, 0.053, 0.034], {
        longitudeSegments: 22,
        latitudeSegments: 14,
      }),
    },
    {
      zoneId: 'surface-perineum',
      clinicalLabel: 'Damm',
      geometry: ellipsoidGeometry([0, 0.925, -0.015], [0.045, 0.026, 0.045], {
        longitudeSegments: 18,
        latitudeSegments: 12,
      }),
    },
    {
      zoneId: 'surface-anus',
      clinicalLabel: 'Anus',
      material: 1,
      geometry: ellipsoidGeometry([0, 0.943, -0.145], [0.024, 0.028, 0.006], {
        longitudeSegments: 18,
        latitudeSegments: 12,
      }),
    },
  ];

  for (const side of [-1, 1]) {
    const sideId = sideName(side);
    parts.push(
      {
        zoneId: `surface-eye-${sideId}`,
        clinicalLabel: `Auge ${sideLabel(side)}`,
        material: 2,
        geometry: ellipsoidGeometry([side * 0.035, 1.625, 0.106], [0.022, 0.012, 0.009], {
          longitudeSegments: 18,
          latitudeSegments: 10,
        }),
      },
      {
        zoneId: `surface-iris-${sideId}`,
        clinicalLabel: `Iris ${sideLabel(side)}`,
        material: 3,
        geometry: ellipsoidGeometry([side * 0.035, 1.625, 0.114], [0.008, 0.008, 0.003], {
          longitudeSegments: 14,
          latitudeSegments: 9,
        }),
      },
      {
        zoneId: `surface-pupil-${sideId}`,
        clinicalLabel: `Pupille ${sideLabel(side)}`,
        material: 4,
        geometry: ellipsoidGeometry([side * 0.035, 1.625, 0.117], [0.0035, 0.0035, 0.0015], {
          longitudeSegments: 10,
          latitudeSegments: 7,
        }),
      },
      {
        zoneId: `surface-ear-${sideId}`,
        clinicalLabel: `Ohr ${sideLabel(side)}`,
        geometry: ellipsoidGeometry([side * 0.105, 1.61, -0.002], [0.018, 0.041, 0.013], {
          longitudeSegments: 18,
          latitudeSegments: 12,
        }),
      },
      {
        zoneId: `surface-clavicle-${sideId}`,
        clinicalLabel: `Schlüsselbein ${sideLabel(side)}`,
        geometry: capsuleGeometry(
          [side * 0.03, 1.445, 0.092],
          [side * 0.18, 1.42, 0.075],
          0.012,
          { radialSegments: 14, capSegments: 4, radiusX: 0.013, radiusZ: 0.009 },
        ),
      },
      {
        zoneId: `surface-scapula-${sideId}`,
        clinicalLabel: `Schulterblatt ${sideLabel(side)}`,
        geometry: ellipsoidGeometry([side * 0.095, 1.325, -0.102], [0.065, 0.09, 0.011], {
          longitudeSegments: 20,
          latitudeSegments: 12,
        }),
      },
      {
        zoneId: `surface-shoulder-${sideId}`,
        clinicalLabel: `Schulter ${sideLabel(side)}`,
        geometry: ellipsoidGeometry([side * 0.235, 1.405, 0], [0.062, 0.064, 0.066], {
          longitudeSegments: 22,
          latitudeSegments: 14,
        }),
      },
      {
        zoneId: `surface-upper-arm-${sideId}`,
        clinicalLabel: `Oberarm ${sideLabel(side)}`,
        geometry: capsuleGeometry(
          [side * 0.255, 1.385, 0],
          [side * 0.32, 1.15, 0.002],
          0.046,
          { radialSegments: 20, capSegments: 6, radiusX: 0.048, radiusZ: 0.046 },
        ),
      },
      {
        zoneId: `surface-elbow-${sideId}`,
        clinicalLabel: `Ellenbogen ${sideLabel(side)}`,
        geometry: ellipsoidGeometry([side * 0.325, 1.115, -0.006], [0.045, 0.042, 0.044], {
          longitudeSegments: 20,
          latitudeSegments: 12,
        }),
      },
      {
        zoneId: `surface-forearm-${sideId}`,
        clinicalLabel: `Unterarm ${sideLabel(side)}`,
        geometry: capsuleGeometry(
          [side * 0.33, 1.085, 0.002],
          [side * 0.365, 0.88, 0.015],
          0.037,
          { radialSegments: 18, capSegments: 5, radiusX: 0.04, radiusZ: 0.037 },
        ),
      },
      {
        zoneId: `surface-wrist-${sideId}`,
        clinicalLabel: `Handgelenk ${sideLabel(side)}`,
        geometry: ellipsoidGeometry([side * 0.368, 0.846, 0.016], [0.032, 0.03, 0.029], {
          longitudeSegments: 18,
          latitudeSegments: 11,
        }),
      },
      {
        zoneId: `surface-thigh-${sideId}`,
        clinicalLabel: `Oberschenkel ${sideLabel(side)}`,
        geometry: capsuleGeometry(
          [side * 0.095, 0.96, 0],
          [side * 0.105, 0.68, 0.008],
          0.071,
          { radialSegments: 24, capSegments: 7, radiusX: 0.074, radiusZ: 0.071 },
        ),
      },
      {
        zoneId: `surface-knee-${sideId}`,
        clinicalLabel: `Knie ${sideLabel(side)}`,
        geometry: ellipsoidGeometry([side * 0.105, 0.625, 0.022], [0.061, 0.06, 0.059], {
          longitudeSegments: 22,
          latitudeSegments: 14,
          frontBias: 0.08,
        }),
      },
      {
        zoneId: `surface-lower-leg-${sideId}`,
        clinicalLabel: `Unterschenkel ${sideLabel(side)}`,
        geometry: capsuleGeometry(
          [side * 0.105, 0.57, 0.005],
          [side * 0.105, 0.15, 0],
          0.047,
          { radialSegments: 22, capSegments: 6, radiusX: 0.05, radiusZ: 0.048 },
        ),
      },
      {
        zoneId: `surface-calf-${sideId}`,
        clinicalLabel: `Wade ${sideLabel(side)}`,
        geometry: ellipsoidGeometry(
          [side * 0.105, 0.41, -0.01],
          [0.061, 0.155, 0.058],
          { longitudeSegments: 22, latitudeSegments: 14 },
        ),
      },
      {
        zoneId: `surface-malleolus-medial-${sideId}`,
        clinicalLabel: `Innenknöchel ${sideLabel(side)}`,
        geometry: ellipsoidGeometry(
          [side * 0.076, 0.12, 0],
          [0.024, 0.032, 0.025],
          { longitudeSegments: 16, latitudeSegments: 10 },
        ),
      },
      {
        zoneId: `surface-malleolus-lateral-${sideId}`,
        clinicalLabel: `Außenknöchel ${sideLabel(side)}`,
        geometry: ellipsoidGeometry(
          [side * 0.134, 0.115, 0],
          [0.025, 0.034, 0.026],
          { longitudeSegments: 16, latitudeSegments: 10 },
        ),
      },
    );
    addHand(parts, side);
    addFoot(parts, side);
  }
  return parts;
}

export function buildAdultMaleReferenceGlb() {
  const parts = buildAdultMaleReferenceParts();
  const materials = materialDefinitions();
  const buffers = [];
  const bufferViews = [];
  const accessors = [];
  const meshes = [];
  const nodes = [];
  let byteOffset = 0;
  let vertexCount = 0;
  let triangleCount = 0;

  function appendView(typedArray, target) {
    const bytes = pad4(bytesOf(typedArray));
    const index = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: bytes.length,
      target,
    });
    buffers.push(bytes);
    byteOffset += bytes.length;
    return index;
  }

  function appendAccessor(typedArray, type, componentType, target, min, max) {
    const bufferView = appendView(typedArray, target);
    const components = type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : 1;
    const entry = {
      bufferView,
      componentType,
      count: typedArray.length / components,
      type,
    };
    if (min) entry.min = min;
    if (max) entry.max = max;
    const index = accessors.length;
    accessors.push(entry);
    return index;
  }

  for (const [partIndex, part] of parts.entries()) {
    const bounds = boundsOf(part.geometry.positions);
    const positions = appendAccessor(
      part.geometry.positions,
      'VEC3',
      5126,
      34962,
      bounds.min,
      bounds.max,
    );
    const normals = appendAccessor(part.geometry.normals, 'VEC3', 5126, 34962);
    const uvs = appendAccessor(part.geometry.uvs, 'VEC2', 5126, 34962);
    const indices = appendAccessor(
      part.geometry.indices,
      'SCALAR',
      5123,
      34963,
      [0],
      [part.geometry.positions.length / 3 - 1],
    );
    vertexCount += part.geometry.positions.length / 3;
    triangleCount += part.geometry.indices.length / 3;
    meshes.push({
      name: `zone__${part.zoneId}`,
      extras: {
        anatomicalZoneId: part.zoneId,
        clinicalLabel: part.clinicalLabel,
        technicalReference: true,
        medicallyReviewed: false,
      },
      primitives: [
        {
          attributes: { POSITION: positions, NORMAL: normals, TEXCOORD_0: uvs },
          indices,
          material: part.material ?? 0,
          mode: 4,
        },
      ],
    });
    nodes.push({
      name: `zone__${part.zoneId}`,
      mesh: partIndex,
      extras: {
        anatomicalZoneId: part.zoneId,
        clinicalLabel: part.clinicalLabel,
        technicalReference: true,
        medicallyReviewed: false,
      },
    });
  }

  const binary = Buffer.concat(buffers);
  const gltf = {
    asset: {
      version: '2.0',
      generator: 'CareSuite Self-Developed Adult Male Reference Mesh Generator',
      copyright: 'CareSuite HealthOS Software Technologie',
      extras: {
        bodymap: {
          variantId: 'body-erwachsener-maennlich',
          units: 'meters',
          upAxis: 'Y',
          forwardAxis: 'Z',
          origin: 'floor-center',
          neutralPose: 'clinical-a-pose',
          meshContractVersion: 1,
          referenceModel: true,
          developmentStage: 'technical-reference',
          selfDeveloped: true,
          calibrationOnly: false,
          medicallyReviewed: false,
          sensitiveAnatomyReviewed: false,
          safeForClinicalRelease: false,
          anatomicalScope: [
            'full-body-surface',
            'face',
            'eyes',
            'ears',
            'mouth',
            'hands',
            'feet',
            'buttocks',
            'male-external-genitalia',
            'pressure-injury-risk-surfaces',
          ],
          vertexCount,
          triangleCount,
        },
      },
    },
    buffers: [{ byteLength: binary.length }],
    bufferViews,
    accessors,
    materials,
    meshes,
    nodes,
    scenes: [{ name: 'adult-male-technical-reference', nodes: nodes.map((_, index) => index) }],
    scene: 0,
  };

  const json = pad4(Buffer.from(JSON.stringify(gltf), 'utf8'), 0x20);
  const bin = pad4(binary);
  const totalLength = 12 + 8 + json.length + 8 + bin.length;
  const output = Buffer.alloc(totalLength);
  output.writeUInt32LE(GLB_MAGIC, 0);
  output.writeUInt32LE(GLB_VERSION, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(json.length, 12);
  output.writeUInt32LE(JSON_CHUNK, 16);
  json.copy(output, 20);
  const binaryHeaderOffset = 20 + json.length;
  output.writeUInt32LE(bin.length, binaryHeaderOffset);
  output.writeUInt32LE(BIN_CHUNK, binaryHeaderOffset + 4);
  bin.copy(output, binaryHeaderOffset + 8);

  return {
    bytes: output,
    summary: {
      variantId: 'body-erwachsener-maennlich',
      parts: parts.length,
      zones: parts.map((part) => part.zoneId),
      vertices: vertexCount,
      triangles: triangleCount,
      medicallyReviewed: false,
      safeForClinicalRelease: false,
    },
  };
}
