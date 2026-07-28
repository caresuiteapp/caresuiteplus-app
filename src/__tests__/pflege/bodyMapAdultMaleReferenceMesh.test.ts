import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import meshManifest from '../../../assets/bodymap3d/v2/medical-mesh-manifest.json';
import { buildAdultMaleReferenceGlb } from '../../../scripts/lib/bodymap-adult-male-reference-glb.mjs';
import { inspectBodyMapGlb } from '../../../scripts/lib/bodymap-glb-inspector.mjs';

const variantId = 'body-erwachsener-maennlich';
const requiredZones = [
  ...meshManifest.requiredCoreZones,
  ...meshManifest.requiredAnatomyZones.penis,
];

function inspect(bytes: Buffer) {
  return inspectBodyMapGlb(bytes, {
    expectedVariantId: variantId,
    expectedHeightMeters: 1.72,
    requiredZoneIds: requiredZones,
    maximumVertices: meshManifest.qualityLimits.maximumVertices,
    maximumTriangles: meshManifest.qualityLimits.maximumTriangles,
    maximumFileSizeBytes: meshManifest.qualityLimits.maximumFileSizeBytes,
  });
}

describe('selbst entwickelter Erwachsenen-Referenzkörper männlich', () => {
  it('erzeugt deterministische GLB-Bytes', () => {
    const first = buildAdultMaleReferenceGlb();
    const second = buildAdultMaleReferenceGlb();
    expect(first.bytes.equals(second.bytes)).toBe(true);
  }, 20_000);

  it('besteht den GLB-Vertrag mit detaillierten Oberflächenzonen', () => {
    const generated = buildAdultMaleReferenceGlb();
    const report = inspect(generated.bytes);
    expect(report.valid).toBe(true);
    expect(report.stats?.vertices).toBeGreaterThan(20_000);
    expect(report.stats?.triangles).toBeGreaterThan(35_000);
    expect(report.zones.found.length).toBeGreaterThanOrEqual(100);
    expect(report.zones.missing).toEqual([]);
  });

  it('enthält Gesicht, Hände, Füße, Dekubituszonen und männliche äußere Genitalanatomie', () => {
    const report = inspect(buildAdultMaleReferenceGlb().bytes);
    expect(report.zones.found).toEqual(
      expect.arrayContaining([
        'surface-occiput',
        'surface-eye-left',
        'surface-ear-right',
        'surface-upper-lip',
        'surface-hand-left',
        'surface-thumb-right',
        'surface-sole-right',
        'surface-heel-left',
        'surface-scapula-left',
        'surface-sacrum',
        'surface-coccyx',
        'surface-ischial-left',
        'surface-buttock-right',
        'surface-penis',
        'surface-glans',
        'surface-scrotum-left',
        'surface-scrotum-right',
        'surface-anus',
      ]),
    );
  });

  it('trägt eine unverwechselbare medizinische Freigabesperre', () => {
    const report = inspect(buildAdultMaleReferenceGlb().bytes);
    expect(report.metadata).toMatchObject({
      referenceModel: true,
      selfDeveloped: true,
      calibrationOnly: false,
      medicallyReviewed: false,
      sensitiveAnatomyReviewed: false,
      safeForClinicalRelease: false,
    });
  });

  it('entspricht bytegenau dem eingecheckten öffentlichen Asset', () => {
    const committed = readFileSync(
      resolve(process.cwd(), 'public/bodymap3d/v2/body-erwachsener-maennlich-v2.glb'),
    );
    expect(committed.equals(buildAdultMaleReferenceGlb().bytes)).toBe(true);
  });

  it('wird vom produktiv verwendeten Three.js-GLTFLoader als echte Szene geladen', async () => {
    const bytes = buildAdultMaleReferenceGlb().bytes;
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const loaded = await new Promise<Awaited<ReturnType<GLTFLoader['loadAsync']>>>(
      (resolveLoaded, rejectLoaded) => {
        new GLTFLoader().parse(arrayBuffer, '', resolveLoaded, rejectLoaded);
      },
    );
    expect(loaded.scene.children).toHaveLength(114);
    const zoneObjects = loaded.scene.children.filter(
      (object) => typeof object.userData.anatomicalZoneId === 'string',
    );
    expect(zoneObjects).toHaveLength(114);
  });
});
