const SHELL_ZONE_TOKENS = [
  'scalp',
  'face',
  'neck',
  'chest',
  'pectoral',
  'breast',
  'abdomen',
  'pelvis',
  'buttock',
  'shoulder',
  'upper-arm',
  'elbow',
  'forearm',
  'wrist',
  'thigh',
  'knee',
  'lower-leg',
  'calf',
  'malleolus',
  'foot',
  'heel',
  'penis',
  'glans',
  'scrotum',
  'mons-pubis',
  'labium-majus',
  'pubic-region-unclassified',
];

const SHELL_EXCLUDED_TOKENS = [
  'eye',
  'iris',
  'pupil',
  'nose',
  'lip',
  'ear',
  'nipple',
  'areola',
  'navel',
  'nail',
  'spine',
  'clavicle',
  'scapula',
  'sacrum',
  'coccyx',
  'ischial',
  'sole',
  'urethral-opening',
  'labium-minus',
  'clitoral',
  'vaginal-opening',
  'perineum',
  'anus',
  'observation-deferred',
];

const TETRAHEDRA = [
  [0, 5, 1, 6],
  [0, 1, 2, 6],
  [0, 2, 3, 6],
  [0, 3, 7, 6],
  [0, 7, 4, 6],
  [0, 4, 5, 6],
];

function boundsOf(positions) {
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (let index = 0; index < positions.length; index += 3) {
    min[0] = Math.min(min[0], positions[index]);
    min[1] = Math.min(min[1], positions[index + 1]);
    min[2] = Math.min(min[2], positions[index + 2]);
    max[0] = Math.max(max[0], positions[index]);
    max[1] = Math.max(max[1], positions[index + 1]);
    max[2] = Math.max(max[2], positions[index + 2]);
  }
  return { min, max };
}

function isShellZone(zoneId) {
  return (
    SHELL_ZONE_TOKENS.some((token) => zoneId.includes(token)) &&
    !SHELL_EXCLUDED_TOKENS.some((token) => zoneId.includes(token))
  );
}

function isVisibleSurfaceDetail(zoneId) {
  return [
    'eye',
    'iris',
    'pupil',
    'nose',
    'lip',
    'ear',
    'nipple',
    'areola',
    'navel',
    'nail',
    'glans',
    'urethral-opening',
    'labium-minus',
    'clitoral',
    'vaginal-opening',
    'anus',
  ].some((token) => zoneId.includes(token));
}

function kernelInflation(zoneId) {
  if (zoneId.includes('shoulder') || zoneId.includes('elbow') || zoneId.includes('knee')) {
    return [1.08, 1.06, 1.08];
  }
  if (
    zoneId.includes('upper-arm') ||
    zoneId.includes('forearm') ||
    zoneId.includes('thigh') ||
    zoneId.includes('lower-leg')
  ) {
    return [1.06, 1.04, 1.06];
  }
  if (
    zoneId.includes('chest') ||
    zoneId.includes('abdomen') ||
    zoneId.includes('pelvis') ||
    zoneId.includes('buttock')
  ) {
    return [1.045, 1.035, 1.055];
  }
  return [1.035, 1.025, 1.04];
}

function kernelsFromParts(parts) {
  return parts.filter((part) => isShellZone(part.zoneId)).map((part) => {
    const { min, max } = boundsOf(part.geometry.positions);
    const inflation = kernelInflation(part.zoneId);
    const center = [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    ];
    const radii = [
      Math.max((max[0] - min[0]) / 2, 0.008) * inflation[0],
      Math.max((max[1] - min[1]) / 2, 0.008) * inflation[1],
      Math.max((max[2] - min[2]) / 2, 0.008) * inflation[2],
    ];
    return { center, radii, zoneId: part.zoneId };
  });
}

function smoothMinimum(a, b, smoothing = 0.16) {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / smoothing));
  return b * (1 - h) + a * h - smoothing * h * (1 - h);
}

function fieldAt(point, kernels) {
  let distance = Number.POSITIVE_INFINITY;
  for (const kernel of kernels) {
    const dx = (point[0] - kernel.center[0]) / kernel.radii[0];
    const dy = (point[1] - kernel.center[1]) / kernel.radii[1];
    const dz = (point[2] - kernel.center[2]) / kernel.radii[2];
    const kernelDistance = Math.hypot(dx, dy, dz) - 1;
    distance =
      distance === Number.POSITIVE_INFINITY
        ? kernelDistance
        : smoothMinimum(distance, kernelDistance);
  }
  return distance;
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function gradientAt(point, kernels, epsilon) {
  const x0 = fieldAt([point[0] - epsilon, point[1], point[2]], kernels);
  const x1 = fieldAt([point[0] + epsilon, point[1], point[2]], kernels);
  const y0 = fieldAt([point[0], point[1] - epsilon, point[2]], kernels);
  const y1 = fieldAt([point[0], point[1] + epsilon, point[2]], kernels);
  const z0 = fieldAt([point[0], point[1], point[2] - epsilon], kernels);
  const z1 = fieldAt([point[0], point[1], point[2] + epsilon], kernels);
  return normalize([x1 - x0, y1 - y0, z1 - z0]);
}

function interpolateIso(pointA, pointB, valueA, valueB) {
  const denominator = valueA - valueB;
  const progress =
    Math.abs(denominator) < 1e-8
      ? 0.5
      : Math.max(0, Math.min(1, valueA / denominator));
  return [
    pointA[0] + (pointB[0] - pointA[0]) * progress,
    pointA[1] + (pointB[1] - pointA[1]) * progress,
    pointA[2] + (pointB[2] - pointA[2]) * progress,
  ];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function orientedTriangle(a, b, c, kernels, epsilon) {
  const center = [
    (a[0] + b[0] + c[0]) / 3,
    (a[1] + b[1] + c[1]) / 3,
    (a[2] + b[2] + c[2]) / 3,
  ];
  const faceNormal = cross(subtract(b, a), subtract(c, a));
  const gradient = gradientAt(center, kernels, epsilon);
  const alignment =
    faceNormal[0] * gradient[0] +
    faceNormal[1] * gradient[1] +
    faceNormal[2] * gradient[2];
  return alignment >= 0 ? [a, b, c] : [a, c, b];
}

function tetraTriangles(points, values, kernels, epsilon) {
  const inside = [];
  const outside = [];
  for (let index = 0; index < 4; index += 1) {
    (values[index] <= 0 ? inside : outside).push(index);
  }
  if (inside.length === 0 || inside.length === 4) return [];

  const edgePoint = (a, b) =>
    interpolateIso(points[a], points[b], values[a], values[b]);

  if (inside.length === 1) {
    const source = inside[0];
    return [
      orientedTriangle(
        edgePoint(source, outside[0]),
        edgePoint(source, outside[1]),
        edgePoint(source, outside[2]),
        kernels,
        epsilon,
      ),
    ];
  }

  if (inside.length === 3) {
    const source = outside[0];
    return [
      orientedTriangle(
        edgePoint(source, inside[0]),
        edgePoint(source, inside[2]),
        edgePoint(source, inside[1]),
        kernels,
        epsilon,
      ),
    ];
  }

  const a = inside[0];
  const b = inside[1];
  const c = outside[0];
  const d = outside[1];
  const ac = edgePoint(a, c);
  const ad = edgePoint(a, d);
  const bc = edgePoint(b, c);
  const bd = edgePoint(b, d);
  return [
    orientedTriangle(ac, bc, bd, kernels, epsilon),
    orientedTriangle(ac, bd, ad, kernels, epsilon),
  ];
}

export function clinicalVisualSurfaceGeometry(parts) {
  const kernels = kernelsFromParts(parts);
  if (kernels.length === 0) {
    throw new Error('Für die klinische Sichtoberfläche wurden keine Körperkerne gefunden.');
  }

  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const kernel of kernels) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], kernel.center[axis] - kernel.radii[axis]);
      max[axis] = Math.max(max[axis], kernel.center[axis] + kernel.radii[axis]);
    }
  }
  const dimensions = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const padding = dimensions.map((value) => Math.max(value * 0.045, 0.012));
  const domainMin = min.map((value, axis) => value - padding[axis]);
  const domainMax = max.map((value, axis) => value + padding[axis]);
  const cells = [36, 92, 30];
  const pointsPerAxis = cells.map((value) => value + 1);
  const steps = cells.map(
    (value, axis) => (domainMax[axis] - domainMin[axis]) / value,
  );
  const field = new Float32Array(
    pointsPerAxis[0] * pointsPerAxis[1] * pointsPerAxis[2],
  );
  const indexOf = (x, y, z) =>
    x + pointsPerAxis[0] * (y + pointsPerAxis[1] * z);
  const pointAt = (x, y, z) => [
    domainMin[0] + x * steps[0],
    domainMin[1] + y * steps[1],
    domainMin[2] + z * steps[2],
  ];

  for (let z = 0; z < pointsPerAxis[2]; z += 1) {
    for (let y = 0; y < pointsPerAxis[1]; y += 1) {
      for (let x = 0; x < pointsPerAxis[0]; x += 1) {
        field[indexOf(x, y, z)] = fieldAt(pointAt(x, y, z), kernels);
      }
    }
  }

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const epsilon = Math.min(...steps) * 0.45;

  for (let z = 0; z < cells[2]; z += 1) {
    for (let y = 0; y < cells[1]; y += 1) {
      for (let x = 0; x < cells[0]; x += 1) {
        const cubeCoordinates = [
          [x, y, z],
          [x + 1, y, z],
          [x + 1, y + 1, z],
          [x, y + 1, z],
          [x, y, z + 1],
          [x + 1, y, z + 1],
          [x + 1, y + 1, z + 1],
          [x, y + 1, z + 1],
        ];
        const cubePoints = cubeCoordinates.map(([cx, cy, cz]) => pointAt(cx, cy, cz));
        const cubeValues = cubeCoordinates.map(
          ([cx, cy, cz]) => field[indexOf(cx, cy, cz)],
        );

        for (const tetrahedron of TETRAHEDRA) {
          const tetraPoints = tetrahedron.map((index) => cubePoints[index]);
          const tetraValues = tetrahedron.map((index) => cubeValues[index]);
          const triangles = tetraTriangles(
            tetraPoints,
            tetraValues,
            kernels,
            epsilon,
          );
          for (const triangle of triangles) {
            for (const point of triangle) {
              positions.push(...point);
              normals.push(...gradientAt(point, kernels, epsilon));
              const u =
                0.5 +
                Math.atan2(point[2], point[0]) /
                  (2 * Math.PI);
              const v = (point[1] - domainMin[1]) / (domainMax[1] - domainMin[1]);
              uvs.push(u, v);
              indices.push(indices.length);
            }
          }
        }
      }
    }
  }

  const IndexArray = indices.length > 65535 ? Uint32Array : Uint16Array;
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new IndexArray(indices),
  };
}

export function withClinicalVisualSurface(parts, variantId) {
  const proxiedParts = parts.map((part) => ({
    ...part,
    interactionProxy: !isVisibleSurfaceDetail(part.zoneId),
  }));
  return [
    {
      zoneId: `visual-surface-${variantId}`,
      clinicalLabel: 'Zusammenhängende klinische Körperoberfläche',
      renderOnly: true,
      material: 0,
      geometry: clinicalVisualSurfaceGeometry(parts),
    },
    ...proxiedParts,
  ];
}
