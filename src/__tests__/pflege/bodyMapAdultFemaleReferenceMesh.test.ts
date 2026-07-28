import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import meshManifest from '../../../assets/bodymap3d/v2/medical-mesh-manifest.json';
import { buildAdultFemaleReferenceGlb } from '../../../scripts/lib/bodymap-adult-female-reference-glb.mjs';
import { inspectBodyMapGlb } from '../../../scripts/lib/bodymap-glb-inspector.mjs';

const variantId = 'body-erwachsener-weiblich';
const requiredZones = [
  ...meshManifest.requiredCoreZones,
  ...meshManifest.requiredAnatomyZones.vulva,
  ...meshManifest.requiredChestZones.breasts,
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

describe('selbst entwickelter Erwachsenen-Referenzkörper weiblich', () => {
  it('erzeugt deterministische weibliche GLB-Bytes', () => {
    const first = buildAdultFemaleReferenceGlb();
    const second = buildAdultFemaleReferenceGlb();
    expect(first.bytes.equals(second.bytes)).toBe(true);
  }, 20_000);

  it('besteht den GLB-Vertrag mit mehr als 100 einzeln anklickbaren Zonen', () => {
    const report = inspect(buildAdultFemaleReferenceGlb().bytes);
    expect(report.valid).toBe(true);
    expect(report.stats?.vertices).toBeGreaterThan(25_000);
    expect(report.stats?.triangles).toBeGreaterThan(45_000);
    expect(report.zones.found).toHaveLength(119);
    expect(report.zones.missing).toEqual([]);
  });

  it('enthält Brüste, Vulva, Dekubituszonen, Gesicht, Hände und Füße', () => {
    const report = inspect(buildAdultFemaleReferenceGlb().bytes);
    expect(report.zones.found).toEqual(
      expect.arrayContaining([
        'surface-breast-left',
        'surface-breast-right',
        'surface-areola-left',
        'surface-nipple-right',
        'surface-mons-pubis',
        'surface-labium-majus-left',
        'surface-labium-majus-right',
        'surface-labium-minus-left',
        'surface-labium-minus-right',
        'surface-clitoral-region',
        'surface-urethral-opening-vulva',
        'surface-vaginal-opening',
        'surface-perineum',
        'surface-anus',
        'surface-sacrum',
        'surface-coccyx',
        'surface-ischial-left',
        'surface-heel-right',
        'surface-eye-left',
        'surface-hand-right',
        'surface-sole-left',
      ]),
    );
  });

  it('trägt die vollständige medizinische und sensible Freigabesperre', () => {
    const report = inspect(buildAdultFemaleReferenceGlb().bytes);
    expect(report.metadata).toMatchObject({
      variantId,
      referenceModel: true,
      selfDeveloped: true,
      calibrationOnly: false,
      medicallyReviewed: false,
      sensitiveAnatomyReviewed: false,
      safeForClinicalRelease: false,
    });
    expect(report.metadata?.anatomicalScope).toEqual(
      expect.arrayContaining(['breasts', 'female-external-genitalia']),
    );
  });

  it('entspricht bytegenau dem eingecheckten öffentlichen weiblichen Asset', () => {
    const committed = readFileSync(
      resolve(process.cwd(), 'public/bodymap3d/v2/body-erwachsener-weiblich-v2.glb'),
    );
    expect(committed.equals(buildAdultFemaleReferenceGlb().bytes)).toBe(true);
  });

  it('wird vom produktiven Three.js-GLTFLoader als echte Szene mit 119 Zonen geladen', async () => {
    const bytes = buildAdultFemaleReferenceGlb().bytes;
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const loaded = await new Promise<Awaited<ReturnType<GLTFLoader['loadAsync']>>>(
      (resolveLoaded, rejectLoaded) => {
        new GLTFLoader().parse(arrayBuffer, '', resolveLoaded, rejectLoaded);
      },
    );
    expect(loaded.scene.children).toHaveLength(119);
    const zoneObjects = loaded.scene.children.filter(
      (object) => typeof object.userData.anatomicalZoneId === 'string',
    );
    expect(zoneObjects).toHaveLength(119);
  });
});
