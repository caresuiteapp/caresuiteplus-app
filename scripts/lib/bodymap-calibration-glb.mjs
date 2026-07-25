function bytesOf(view) {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}

function pad4(buffer, fill = 0) {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding, fill)]) : buffer;
}

function cuboidGeometry(width, height, depth) {
  const x = width / 2;
  const z = depth / 2;
  const y0 = 0;
  const y1 = height;
  const faces = [
    { normal: [0, 0, 1], corners: [[-x, y0, z], [x, y0, z], [x, y1, z], [-x, y1, z]] },
    { normal: [0, 0, -1], corners: [[x, y0, -z], [-x, y0, -z], [-x, y1, -z], [x, y1, -z]] },
    { normal: [-1, 0, 0], corners: [[-x, y0, -z], [-x, y0, z], [-x, y1, z], [-x, y1, -z]] },
    { normal: [1, 0, 0], corners: [[x, y0, z], [x, y0, -z], [x, y1, -z], [x, y1, z]] },
    { normal: [0, 1, 0], corners: [[-x, y1, z], [x, y1, z], [x, y1, -z], [-x, y1, -z]] },
    { normal: [0, -1, 0], corners: [[-x, y0, -z], [x, y0, -z], [x, y0, z], [-x, y0, z]] },
  ];
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const faceUvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (const [faceIndex, face] of faces.entries()) {
    const base = faceIndex * 4;
    for (let index = 0; index < 4; index += 1) {
      positions.push(...face.corners[index]);
      normals.push(...face.normal);
      uvs.push(...faceUvs[index]);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

export function buildBodyMapCalibrationGlb({
  variantId,
  nominalHeightMeters,
  zoneIds,
}) {
  const geometry = cuboidGeometry(0.52, nominalHeightMeters, 0.28);
  const views = [
    pad4(bytesOf(geometry.positions)),
    pad4(bytesOf(geometry.normals)),
    pad4(bytesOf(geometry.uvs)),
    pad4(bytesOf(geometry.indices)),
  ];
  const offsets = [];
  let byteOffset = 0;
  for (const view of views) {
    offsets.push(byteOffset);
    byteOffset += view.length;
  }
  const binary = Buffer.concat(views);
  const nodes = zoneIds.map((zoneId, index) => ({
    name: `zone__${zoneId}`,
    extras: { anatomicalZoneId: zoneId, calibrationOnly: true },
    ...(index === 0 ? { mesh: 0 } : {}),
  }));
  const gltf = {
    asset: {
      version: '2.0',
      generator: 'CareSuite Bodymap Calibration GLB Generator',
      extras: {
        bodymap: {
          variantId,
          units: 'meters',
          upAxis: 'Y',
          forwardAxis: 'Z',
          origin: 'floor-center',
          meshContractVersion: 1,
          calibrationOnly: true,
          medicallyReviewed: false,
        },
      },
    },
    buffers: [{ byteLength: binary.length }],
    bufferViews: [
      { buffer: 0, byteOffset: offsets[0], byteLength: views[0].length, target: 34962 },
      { buffer: 0, byteOffset: offsets[1], byteLength: views[1].length, target: 34962 },
      { buffer: 0, byteOffset: offsets[2], byteLength: views[2].length, target: 34962 },
      { buffer: 0, byteOffset: offsets[3], byteLength: views[3].length, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: geometry.positions.length / 3,
        type: 'VEC3',
        min: [-0.26, 0, -0.14],
        max: [0.26, nominalHeightMeters, 0.14],
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: geometry.normals.length / 3,
        type: 'VEC3',
      },
      {
        bufferView: 2,
        componentType: 5126,
        count: geometry.uvs.length / 2,
        type: 'VEC2',
      },
      {
        bufferView: 3,
        componentType: 5123,
        count: geometry.indices.length,
        type: 'SCALAR',
        min: [0],
        max: [23],
      },
    ],
    materials: [
      {
        name: 'skin_calibration',
        extras: { bodymapSkinMaterial: true, calibrationOnly: true },
        pbrMetallicRoughness: {
          baseColorFactor: [0.725, 0.471, 0.333, 1],
          metallicFactor: 0,
          roughnessFactor: 0.62,
        },
      },
    ],
    meshes: [
      {
        name: 'technical-calibration-cuboid-not-medical-anatomy',
        extras: { calibrationOnly: true, medicallyReviewed: false },
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
            indices: 3,
            material: 0,
            mode: 4,
          },
        ],
      },
    ],
    nodes,
    scenes: [{ name: 'bodymap-calibration', nodes: nodes.map((_, index) => index) }],
    scene: 0,
  };

  const json = pad4(Buffer.from(JSON.stringify(gltf), 'utf8'), 0x20);
  const bin = pad4(binary);
  const totalLength = 12 + 8 + json.length + 8 + bin.length;
  const output = Buffer.alloc(totalLength);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(json.length, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  json.copy(output, 20);
  const binaryHeaderOffset = 20 + json.length;
  output.writeUInt32LE(bin.length, binaryHeaderOffset);
  output.writeUInt32LE(0x004e4942, binaryHeaderOffset + 4);
  bin.copy(output, binaryHeaderOffset + 8);
  return output;
}
