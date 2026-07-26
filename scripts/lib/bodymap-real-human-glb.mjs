import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const SOURCE_ROOT = resolve('assets/bodymap3d/v3/source');
const BASE_OBJ = resolve(SOURCE_ROOT, 'base-human.obj');
const TARGET_ROOT = resolve(SOURCE_ROOT, 'macrodetails');

export const REAL_HUMAN_SOURCE = {
  name: 'MakeHuman HM08 core topology',
  license: 'CC0-1.0',
  sourceUrl: 'https://github.com/makehumancommunity/makehuman',
  importedCommit: '617c78e14ddfce78de938998bf45b2e13ff76edb',
  careSuiteImplementation:
    'Independent CareSuite OBJ/target morph, normalization, glTF and clinical overlay pipeline',
};

const AGE_BLEND = {
  baby: { baby: 1 },
  kleinkind: { baby: 0.35, child: 0.65 },
  kind: { child: 1 },
  jugendlicher: { child: 0.35, young: 0.65 },
  'junger-erwachsener': { young: 1 },
  erwachsener: { young: 0.75, old: 0.25 },
  senior: { young: 0.3, old: 0.7 },
  hochbetagt: { old: 1 },
};

function variantTokens(variantId) {
  const withoutPrefix = variantId.replace(/^body-/, '');
  const sex = withoutPrefix.includes('-maennlich')
    ? 'male'
    : withoutPrefix.includes('-weiblich')
      ? 'female'
      : 'divers';
  const age = Object.keys(AGE_BLEND)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => withoutPrefix.startsWith(`${candidate}-`));
  if (!age) throw new Error(`Unbekannte Altersgruppe in ${variantId}`);
  let femaleWeight = sex === 'female' ? 1 : sex === 'male' ? 0 : 0.5;
  if (sex === 'divers' && /-brueste$/.test(variantId) && !/-keine-brueste$/.test(variantId)) {
    femaleWeight = 0.72;
  } else if (sex === 'divers' && /-keine-brueste$/.test(variantId)) {
    femaleWeight = 0.32;
  }
  return { age, sex, femaleWeight };
}

function targetPlan(variantId) {
  const { age, femaleWeight } = variantTokens(variantId);
  const result = [];
  for (const [stage, ageWeight] of Object.entries(AGE_BLEND[age])) {
    if (femaleWeight < 1) {
      result.push({
        file: `caucasian-male-${stage}.target`,
        weight: ageWeight * (1 - femaleWeight),
      });
    }
    if (femaleWeight > 0) {
      result.push({
        file: `caucasian-female-${stage}.target`,
        weight: ageWeight * femaleWeight,
      });
    }
  }
  return result.filter((entry) => entry.weight > 0.00001);
}

function parseObj(source) {
  const positions = [];
  const uvs = [];
  const facesByGroup = new Map();
  let group = null;
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const tokens = line.split(/\s+/);
    if (tokens[0] === 'v') {
      positions.push([Number(tokens[1]), Number(tokens[2]), Number(tokens[3])]);
    } else if (tokens[0] === 'vt') {
      uvs.push([Number(tokens[1]), Number(tokens[2])]);
    } else if (tokens[0] === 'g') {
      group = tokens[1];
      if (!facesByGroup.has(group)) facesByGroup.set(group, []);
    } else if (tokens[0] === 'f' && group) {
      facesByGroup.get(group).push(
        tokens.slice(1).map((token) => {
          const [position, uv] = token.split('/');
          return {
            position: Number(position) - 1,
            uv: uv ? Number(uv) - 1 : null,
          };
        }),
      );
    }
  }
  return { positions, uvs, facesByGroup };
}

function applyTarget(positions, source, weight) {
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const tokens = line.split(/\s+/);
    const index = Number(tokens[0]);
    if (!Number.isInteger(index) || !positions[index]) continue;
    positions[index][0] += Number(tokens[1]) * weight;
    positions[index][1] += Number(tokens[2]) * weight;
    positions[index][2] += Number(tokens[3]) * weight;
  }
}

function bodyVertexIndices(facesByGroup) {
  const indices = new Set();
  for (const corner of (facesByGroup.get('body') ?? []).flat()) {
    indices.add(corner.position);
  }
  return indices;
}

function normalizePositions(positions, bodyIndices, nominalHeightMeters) {
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  for (const index of bodyIndices) {
    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis] = Math.min(bounds.min[axis], positions[index][axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], positions[index][axis]);
    }
  }
  const sourceHeight = bounds.max[1] - bounds.min[1];
  const scale = nominalHeightMeters / sourceHeight;
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const centerZ = (bounds.min[2] + bounds.max[2]) / 2;
  for (const position of positions) {
    position[0] = (position[0] - centerX) * scale;
    position[1] = (position[1] - bounds.min[1]) * scale;
    position[2] = (position[2] - centerZ) * scale;
  }
  return { scale, sourceHeight };
}

function applyClinicalStandingPose(positions, nominalHeightMeters) {
  const shoulderY = nominalHeightMeters * 0.79;
  const shoulderX = nominalHeightMeters * 0.135;
  const blendStart = nominalHeightMeters * 0.105;
  const blendEnd = nominalHeightMeters * 0.19;
  const minimumArmY = nominalHeightMeters * 0.46;
  const maximumArmY = nominalHeightMeters * 0.86;
  const rotation = 0.76;
  for (const position of positions) {
    const side = Math.sign(position[0]);
    const absoluteX = Math.abs(position[0]);
    if (
      side === 0 ||
      absoluteX <= blendStart ||
      position[1] < minimumArmY ||
      position[1] > maximumArmY
    ) {
      continue;
    }
    const weight = Math.max(
      0,
      Math.min(1, (absoluteX - blendStart) / (blendEnd - blendStart)),
    );
    const pivotX = shoulderX * side;
    const localX = position[0] - pivotX;
    const localY = position[1] - shoulderY;
    const angle = -side * rotation * weight;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    position[0] = pivotX + localX * cosine - localY * sine;
    position[1] = shoulderY + localX * sine + localY * cosine;
  }
}

function addTo(target, index, vector) {
  target[index * 3] += vector[0];
  target[index * 3 + 1] += vector[1];
  target[index * 3 + 2] += vector[2];
}

function faceNormal(a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
}

function geometryForGroup(model, groupName) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const vertexMap = new Map();
  const sourceFaces = model.facesByGroup.get(groupName) ?? [];

  const vertexFor = (corner) => {
    const key = `${corner.position}/${corner.uv ?? -1}`;
    if (vertexMap.has(key)) return vertexMap.get(key);
    const index = positions.length / 3;
    vertexMap.set(key, index);
    positions.push(...model.positions[corner.position]);
    const uv = corner.uv === null ? [0, 0] : model.uvs[corner.uv] ?? [0, 0];
    uvs.push(uv[0], 1 - uv[1]);
    return index;
  };

  for (const face of sourceFaces) {
    for (let triangle = 1; triangle < face.length - 1; triangle += 1) {
      indices.push(
        vertexFor(face[0]),
        vertexFor(face[triangle]),
        vertexFor(face[triangle + 1]),
      );
    }
  }

  const normals = new Float32Array(positions.length);
  for (let index = 0; index < indices.length; index += 3) {
    const aIndex = indices[index];
    const bIndex = indices[index + 1];
    const cIndex = indices[index + 2];
    const a = positions.slice(aIndex * 3, aIndex * 3 + 3);
    const b = positions.slice(bIndex * 3, bIndex * 3 + 3);
    const c = positions.slice(cIndex * 3, cIndex * 3 + 3);
    const normal = faceNormal(a, b, c);
    addTo(normals, aIndex, normal);
    addTo(normals, bIndex, normal);
    addTo(normals, cIndex, normal);
  }
  for (let index = 0; index < normals.length; index += 3) {
    const length =
      Math.hypot(normals[index], normals[index + 1], normals[index + 2]) || 1;
    normals[index] /= length;
    normals[index + 1] /= length;
    normals[index + 2] /= length;
  }

  return {
    positions: new Float32Array(positions),
    normals,
    uvs: new Float32Array(uvs),
    indices:
      positions.length / 3 > 65535
        ? new Uint32Array(indices)
        : new Uint16Array(indices),
  };
}

function geometryBounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[index + axis]);
      max[axis] = Math.max(max[axis], positions[index + axis]);
    }
  }
  return { min, max };
}

function discGeometry({ center, radius, segments = 32, zOffset = 0 }) {
  const positions = [center[0], center[1], center[2] + zOffset];
  const normals = [0, 0, 1];
  const uvs = [0.5, 0.5];
  const indices = [];
  for (let segment = 0; segment < segments; segment += 1) {
    const angle = (segment / segments) * Math.PI * 2;
    positions.push(
      center[0] + Math.cos(angle) * radius,
      center[1] + Math.sin(angle) * radius,
      center[2] + zOffset,
    );
    normals.push(0, 0, 1);
    uvs.push((Math.cos(angle) + 1) / 2, (Math.sin(angle) + 1) / 2);
  }
  for (let segment = 0; segment < segments; segment += 1) {
    indices.push(0, segment + 1, ((segment + 1) % segments) + 1);
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

function eyeSurfaceDetails(eyeGeometry, sideLabel) {
  const bounds = geometryBounds(eyeGeometry.positions);
  const width = bounds.max[0] - bounds.min[0];
  const height = bounds.max[1] - bounds.min[1];
  const irisRadius = Math.min(width, height) * 0.205;
  const center = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    bounds.max[2],
  ];
  return [
    {
      name: `real-human-iris-${sideLabel}`,
      label: `${sideLabel === 'left' ? 'Linke' : 'Rechte'} Iris`,
      material: 3,
      geometry: discGeometry({
        center,
        radius: irisRadius,
        zOffset: 0.00035,
      }),
    },
    {
      name: `real-human-pupil-${sideLabel}`,
      label: `${sideLabel === 'left' ? 'Linke' : 'Rechte'} Pupille`,
      material: 4,
      geometry: discGeometry({
        center,
        radius: irisRadius * 0.43,
        zOffset: 0.00055,
      }),
    },
  ];
}

function pad4(buffer, fill = 0) {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding, fill)]) : buffer;
}

function typedBytes(view) {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function rgbaPng(width, height, pixelAt) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue, alpha = 255] = pixelAt(x, y);
      const offset = row + 1 + x * 4;
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
      raw[offset + 3] = alpha;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

let skinTextureSet;
function proceduralSkinTextures() {
  if (skinTextureSet) return skinTextureSet;
  const size = 128;
  const heightAt = (x, y) => {
    const wrappedX = (x + size) % size;
    const wrappedY = (y + size) % size;
    const cellular =
      Math.sin(wrappedX * 1.73 + wrappedY * 0.37) *
      Math.sin(wrappedY * 1.91 - wrappedX * 0.29);
    const pores = Math.sin(wrappedX * 5.17 + wrappedY * 7.31) * 0.35;
    const broad = Math.sin(wrappedX * 0.19) * Math.cos(wrappedY * 0.23) * 0.3;
    return cellular * 0.55 + pores + broad;
  };
  const normal = rgbaPng(size, size, (x, y) => {
    const dx = heightAt(x + 1, y) - heightAt(x - 1, y);
    const dy = heightAt(x, y + 1) - heightAt(x, y - 1);
    const strength = 0.12;
    const nx = -dx * strength;
    const ny = -dy * strength;
    const nz = 1;
    const length = Math.hypot(nx, ny, nz);
    return [
      Math.round((nx / length * 0.5 + 0.5) * 255),
      Math.round((ny / length * 0.5 + 0.5) * 255),
      Math.round((nz / length * 0.5 + 0.5) * 255),
      255,
    ];
  });
  const metallicRoughness = rgbaPng(size, size, (x, y) => {
    const detail = Math.max(-1, Math.min(1, heightAt(x, y)));
    const roughness = Math.round(178 + detail * 22);
    return [255, 0, roughness, 255];
  });
  skinTextureSet = { normal, metallicRoughness };
  return skinTextureSet;
}

function buildGlb({ variantId, nominalHeightMeters, groups, morphPlan }) {
  const buffers = [];
  const bufferViews = [];
  const accessors = [];
  const meshes = [];
  const nodes = [];
  let byteOffset = 0;
  let vertexCount = 0;
  let triangleCount = 0;

  const appendView = (typedArray, target) => {
    const bytes = pad4(typedBytes(typedArray));
    const bufferView = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: bytes.length,
      target,
    });
    buffers.push(bytes);
    byteOffset += bytes.length;
    return bufferView;
  };
  const appendAccessor = (typedArray, type, componentType, target, min, max) => {
    const components = type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : 1;
    const accessor = accessors.length;
    accessors.push({
      bufferView: appendView(typedArray, target),
      componentType,
      count: typedArray.length / components,
      type,
      ...(min ? { min } : {}),
      ...(max ? { max } : {}),
    });
    return accessor;
  };

  for (const group of groups) {
    const bounds = geometryBounds(group.geometry.positions);
    const position = appendAccessor(
      group.geometry.positions,
      'VEC3',
      5126,
      ARRAY_BUFFER,
      bounds.min,
      bounds.max,
    );
    const normal = appendAccessor(
      group.geometry.normals,
      'VEC3',
      5126,
      ARRAY_BUFFER,
    );
    const uv = appendAccessor(group.geometry.uvs, 'VEC2', 5126, ARRAY_BUFFER);
    const componentType = group.geometry.indices instanceof Uint32Array ? 5125 : 5123;
    const indices = appendAccessor(
      group.geometry.indices,
      'SCALAR',
      componentType,
      ELEMENT_ARRAY_BUFFER,
      [0],
      [group.geometry.positions.length / 3 - 1],
    );
    vertexCount += group.geometry.positions.length / 3;
    triangleCount += group.geometry.indices.length / 3;
    meshes.push({
      name: group.name,
      extras: {
        bodymapRenderSurface: true,
        bodymapRealHumanSurface: true,
        bodymapVisualOnly: true,
        clinicalLabel: group.label,
      },
      primitives: [
        {
          attributes: { POSITION: position, NORMAL: normal, TEXCOORD_0: uv },
          indices,
          material: group.material,
          mode: 4,
        },
      ],
    });
    nodes.push({
      name: group.name,
      mesh: meshes.length - 1,
      extras: {
        bodymapRenderSurface: true,
        bodymapRealHumanSurface: true,
        bodymapVisualOnly: true,
      },
    });
  }

  const skinTextures = proceduralSkinTextures();
  const skinNormalView = appendView(skinTextures.normal);
  const skinRoughnessView = appendView(skinTextures.metallicRoughness);
  const binary = Buffer.concat(buffers);
  const gltf = {
    asset: {
      version: '2.0',
      generator: 'CareSuite Real Human Asset Pipeline v1',
      copyright:
        'CC0 source topology; CareSuite morph, normalization, material and clinical integration',
      extras: {
        bodymap: {
          variantId,
          units: 'meters',
          upAxis: 'Y',
          forwardAxis: 'Z',
          origin: 'floor-center',
          neutralPose: 'clinical-a-pose',
          meshContractVersion: 1,
          visualAssetVersion: 1,
          sourceLicense: 'CC0-1.0',
          sourceTopology: REAL_HUMAN_SOURCE.name,
          visualProductionCandidate: true,
          medicallyReviewed: false,
          safeForClinicalRelease: false,
          nominalHeightMeters,
          morphPlan,
          vertexCount,
          triangleCount,
        },
      },
    },
    buffers: [{ byteLength: binary.length }],
    bufferViews,
    accessors,
    materials: [
      {
        name: 'skin_real_human',
        extras: {
          bodymapSkinMaterial: true,
          materialRole: 'skin',
          pbrSkinCandidate: true,
        },
        pbrMetallicRoughness: {
          baseColorFactor: [0.725, 0.471, 0.333, 1],
          metallicFactor: 0,
          roughnessFactor: 0.5,
          metallicRoughnessTexture: { index: 1 },
        },
        normalTexture: { index: 0, scale: 0.42 },
      },
      {
        name: 'eye_sclera',
        extras: { materialRole: 'eye-sclera' },
        pbrMetallicRoughness: {
          baseColorFactor: [0.92, 0.92, 0.88, 1],
          metallicFactor: 0,
          roughnessFactor: 0.28,
        },
      },
      {
        name: 'mouth_teeth',
        extras: { materialRole: 'oral-detail' },
        pbrMetallicRoughness: {
          baseColorFactor: [0.91, 0.88, 0.79, 1],
          metallicFactor: 0,
          roughnessFactor: 0.35,
        },
      },
      {
        name: 'eye_iris',
        extras: { materialRole: 'eye-iris' },
        pbrMetallicRoughness: {
          baseColorFactor: [0.21, 0.34, 0.4, 1],
          metallicFactor: 0,
          roughnessFactor: 0.24,
        },
      },
      {
        name: 'eye_pupil',
        extras: { materialRole: 'eye-pupil' },
        pbrMetallicRoughness: {
          baseColorFactor: [0.012, 0.016, 0.018, 1],
          metallicFactor: 0,
          roughnessFactor: 0.2,
        },
      },
    ],
    samplers: [
      {
        magFilter: 9729,
        minFilter: 9987,
        wrapS: 10497,
        wrapT: 10497,
      },
    ],
    images: [
      {
        name: 'skin_micro_normal',
        mimeType: 'image/png',
        bufferView: skinNormalView,
      },
      {
        name: 'skin_metallic_roughness',
        mimeType: 'image/png',
        bufferView: skinRoughnessView,
      },
    ],
    textures: [
      { name: 'skin_micro_normal', sampler: 0, source: 0 },
      { name: 'skin_metallic_roughness', sampler: 0, source: 1 },
    ],
    meshes,
    nodes,
    scenes: [{ name: `${variantId}-real-human`, nodes: nodes.map((_, index) => index) }],
    scene: 0,
  };
  const json = pad4(Buffer.from(JSON.stringify(gltf), 'utf8'), 0x20);
  const bin = pad4(binary);
  const output = Buffer.alloc(12 + 8 + json.length + 8 + bin.length);
  output.writeUInt32LE(GLB_MAGIC, 0);
  output.writeUInt32LE(GLB_VERSION, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(json.length, 12);
  output.writeUInt32LE(JSON_CHUNK, 16);
  json.copy(output, 20);
  const binaryHeader = 20 + json.length;
  output.writeUInt32LE(bin.length, binaryHeader);
  output.writeUInt32LE(BIN_CHUNK, binaryHeader + 4);
  bin.copy(output, binaryHeader + 8);
  return {
    bytes: output,
    summary: {
      variantId,
      nominalHeightMeters,
      vertices: vertexCount,
      triangles: triangleCount,
      sourceLicense: 'CC0-1.0',
      medicallyReviewed: false,
      safeForClinicalRelease: false,
      morphPlan,
    },
  };
}

let parsedBasePromise;
async function parsedBase() {
  parsedBasePromise ??= readFile(BASE_OBJ, 'utf8').then(parseObj);
  return parsedBasePromise;
}

export async function buildRealHumanGlb({ variantId, nominalHeightMeters }) {
  const base = await parsedBase();
  const model = {
    positions: base.positions.map((position) => [...position]),
    uvs: base.uvs,
    facesByGroup: base.facesByGroup,
  };
  const morphPlan = targetPlan(variantId);
  for (const target of morphPlan) {
    const source = await readFile(resolve(TARGET_ROOT, target.file), 'utf8');
    applyTarget(model.positions, source, target.weight);
  }
  const bodyIndices = bodyVertexIndices(model.facesByGroup);
  normalizePositions(model.positions, bodyIndices, nominalHeightMeters);
  applyClinicalStandingPose(model.positions, nominalHeightMeters);
  const leftEyeGeometry = geometryForGroup(model, 'helper-l-eye');
  const rightEyeGeometry = geometryForGroup(model, 'helper-r-eye');
  const groups = [
    {
      name: 'real-human-body',
      label: 'Zusammenhängende menschliche Hautoberfläche',
      material: 0,
      geometry: geometryForGroup(model, 'body'),
    },
    {
      name: 'real-human-eye-left',
      label: 'Linkes Auge',
      material: 1,
      geometry: leftEyeGeometry,
    },
    {
      name: 'real-human-eye-right',
      label: 'Rechtes Auge',
      material: 1,
      geometry: rightEyeGeometry,
    },
    {
      name: 'real-human-upper-teeth',
      label: 'Oberkieferzähne',
      material: 2,
      geometry: geometryForGroup(model, 'helper-upper-teeth'),
    },
    {
      name: 'real-human-lower-teeth',
      label: 'Unterkieferzähne',
      material: 2,
      geometry: geometryForGroup(model, 'helper-lower-teeth'),
    },
    ...eyeSurfaceDetails(leftEyeGeometry, 'left'),
    ...eyeSurfaceDetails(rightEyeGeometry, 'right'),
  ].filter((group) => group.geometry.indices.length > 0);
  return buildGlb({ variantId, nominalHeightMeters, groups, morphPlan });
}
