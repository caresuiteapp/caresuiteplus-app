import { describe, expect, it } from 'vitest';
import { inspectBodyMapGlb } from '../../../scripts/lib/bodymap-glb-inspector.mjs';
import { buildBodyMapCalibrationGlb } from '../../../scripts/lib/bodymap-calibration-glb.mjs';
import meshManifest from '../../../assets/bodymap3d/v2/medical-mesh-manifest.json';

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function padded(buffer: Buffer, fill = 0x20) {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding, fill)]) : buffer;
}

function glb(gltf: Record<string, unknown>) {
  const json = padded(Buffer.from(JSON.stringify(gltf), 'utf8'));
  const bin = Buffer.alloc(4);
  const totalLength = 12 + 8 + json.length + 8 + bin.length;
  const output = Buffer.alloc(totalLength);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(json.length, 12);
  output.writeUInt32LE(JSON_CHUNK, 16);
  json.copy(output, 20);
  const binaryHeader = 20 + json.length;
  output.writeUInt32LE(bin.length, binaryHeader);
  output.writeUInt32LE(BIN_CHUNK, binaryHeader + 4);
  bin.copy(output, binaryHeader + 8);
  return output;
}

function validFixture(): any {
  return {
    asset: {
      version: '2.0',
      extras: {
        bodymap: {
          variantId: 'body-erwachsener-maennlich',
          units: 'meters',
          upAxis: 'Y',
          forwardAxis: 'Z',
          origin: 'floor-center',
          meshContractVersion: 1,
        },
      },
    },
    buffers: [{ byteLength: 4 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [-0.2, 0, -0.1],
        max: [0.2, 1.72, 0.1],
      },
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC2' },
      { bufferView: 0, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    materials: [{ name: 'skin_body', extras: { bodymapSkinMaterial: true } }],
    meshes: [
      {
        name: 'medical-body',
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
            indices: 3,
            material: 0,
          },
        ],
      },
    ],
    nodes: [{ name: 'zone__surface-sacrum', mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
}

describe('Bodymap GLB-Binärinspektor', () => {
  it('prüft Header, Metadaten, Maße, Geometrie, Material und Zonen', () => {
    const report = inspectBodyMapGlb(glb(validFixture()), {
      expectedVariantId: 'body-erwachsener-maennlich',
      requiredZoneIds: ['surface-sacrum'],
      expectedHeightMeters: 1.72,
    });
    expect(report.valid).toBe(true);
    expect(report.stats?.vertices).toBe(3);
    expect(report.stats?.triangles).toBe(1);
    expect(report.zones.found).toContain('surface-sacrum');
  });

  it('blockiert externe Ressourcen und fehlende klinische Pflichtdaten', () => {
    const fixture = validFixture();
    fixture.images = [{ uri: 'patient-texture.png' }];
    fixture.meshes[0]!.primitives[0]!.attributes = { POSITION: 0, NORMAL: 1 };
    fixture.asset.extras.bodymap.origin = 'center';
    const report = inspectBodyMapGlb(glb(fixture), {
      expectedVariantId: 'body-erwachsener-maennlich',
      requiredZoneIds: ['surface-eye-left'],
      expectedHeightMeters: 1.72,
    });
    expect(report.valid).toBe(false);
    expect(report.errors.join(' ')).toContain('Externe Bilddateien');
    expect(report.errors.join(' ')).toContain('UV-Koordinaten');
    expect(report.errors.join(' ')).toContain('origin=floor-center');
    expect(report.zones.missing).toContain('surface-eye-left');
  });

  it('blockiert beschädigte oder falsch deklarierte GLB-Dateien', () => {
    const bytes = glb(validFixture());
    bytes.writeUInt32LE(bytes.length + 12, 8);
    const report = inspectBodyMapGlb(bytes);
    expect(report.valid).toBe(false);
    expect(report.errors.join(' ')).toContain('Deklarierte GLB-Länge');
  });

  it('erzeugt eine vollständige technische Kalibrierungsdatei für die Pipeline', () => {
    const requiredZoneIds = [
      ...meshManifest.requiredCoreZones,
      ...meshManifest.requiredAnatomyZones.penis,
    ];
    const bytes = buildBodyMapCalibrationGlb({
      variantId: 'body-erwachsener-maennlich',
      nominalHeightMeters: 1.72,
      zoneIds: requiredZoneIds,
    });
    const report = inspectBodyMapGlb(bytes, {
      expectedVariantId: 'body-erwachsener-maennlich',
      expectedHeightMeters: 1.72,
      requiredZoneIds,
    });
    expect(report.valid).toBe(true);
    expect(report.stats?.vertices).toBe(24);
    expect(report.stats?.triangles).toBe(12);
    expect(report.zones.missing).toEqual([]);
    expect(report.metadata?.calibrationOnly).toBe(true);
  });
});
