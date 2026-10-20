import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import meshManifest from '../../../assets/bodymap3d/v2/medical-mesh-manifest.json';
import {
  AGE_REFERENCE_VARIANTS,
  buildAgeReferenceGlb,
  requiredZonesForAgeReference,
} from '../../../scripts/lib/bodymap-age-reference-glb.mjs';
import { inspectBodyMapGlb } from '../../../scripts/lib/bodymap-glb-inspector.mjs';

const generatedByVariant = new Map<
  string,
  ReturnType<typeof buildAgeReferenceGlb>
>();

function generated(variantId: string) {
  const cached = generatedByVariant.get(variantId);
  if (cached) return cached;
  const value = buildAgeReferenceGlb(variantId);
  generatedByVariant.set(variantId, value);
  return value;
}

function inspect(variantId: string) {
  const variant = meshManifest.variants.find((entry) => entry.id === variantId);
  if (!variant) throw new Error(`Manifestvariante fehlt: ${variantId}`);
  return inspectBodyMapGlb(generated(variantId).bytes, {
    expectedVariantId: variantId,
    expectedHeightMeters: variant.nominalHeightMeters,
    requiredZoneIds: requiredZonesForAgeReference(variantId, meshManifest),
    maximumVertices: meshManifest.qualityLimits.maximumVertices,
    maximumTriangles: meshManifest.qualityLimits.maximumTriangles,
    maximumFileSizeBytes: meshManifest.qualityLimits.maximumFileSizeBytes,
  });
}

describe('14 altersabhängige technische 3D-Referenzkörper', () => {
  it('definiert sieben nicht-generische Altersgruppen jeweils männlich und weiblich', () => {
    expect(AGE_REFERENCE_VARIANTS).toHaveLength(14);
    expect(new Set(AGE_REFERENCE_VARIANTS.map((entry) => entry.id)).size).toBe(14);
    expect(new Set(AGE_REFERENCE_VARIANTS.map((entry) => entry.ageGroup)).size).toBe(7);
  });

  it.each(AGE_REFERENCE_VARIANTS)(
    'erzeugt für $id deterministische GLB-Bytes',
    async (configuration) => {
      await new Promise<void>((resolveReady) => setTimeout(resolveReady, 0));
      expect(generated(configuration.id).bytes.length).toBeGreaterThan(100_000);
    },
    20_000,
  );

  it('besteht für jede Variante Höhen-, Zonen-, UV- und Freigabevertrag', () => {
    for (const configuration of AGE_REFERENCE_VARIANTS) {
      const report = inspect(configuration.id);
      expect(report.valid, `${configuration.id}: ${report.errors.join(', ')}`).toBe(true);
      expect(report.zones.found.length).toBeGreaterThanOrEqual(113);
      expect(report.stats?.vertices).toBeGreaterThan(25_000);
      expect(report.stats?.triangles).toBeGreaterThan(45_000);
      expect(report.metadata).toMatchObject({
        variantId: configuration.id,
        ageGroup: configuration.ageGroup,
        sexPhenotype: configuration.sex,
        selfDeveloped: true,
        medicallyReviewed: false,
        pediatricAnatomyReviewed: false,
        sensitiveAnatomyReviewed: false,
        safeForClinicalRelease: false,
      });
    }
  }, 120_000);

  it('verwendet bei Baby, Kleinkind und Kind keine entwickelten Brustmeshes', () => {
    for (const configuration of AGE_REFERENCE_VARIANTS.filter(
      (entry) =>
        entry.sex === 'weiblich' &&
        ['baby', 'kleinkind', 'kind'].includes(entry.ageGroup),
    )) {
      const zones = inspect(configuration.id).zones.found;
      expect(zones).toEqual(
        expect.arrayContaining([
          'surface-chest',
          'surface-pectoral-left',
          'surface-pectoral-right',
          'surface-nipple-left',
          'surface-nipple-right',
        ]),
      );
      expect(zones).not.toContain('surface-breast-left');
      expect(zones).not.toContain('surface-areola-left');
    }
  }, 120_000);

  it('entspricht bytegenau allen 14 eingecheckten öffentlichen GLBs', () => {
    for (const configuration of AGE_REFERENCE_VARIANTS) {
      const committed = readFileSync(
        resolve(process.cwd(), 'public/bodymap3d/v2', configuration.fileName),
      );
      expect(committed.equals(generated(configuration.id).bytes)).toBe(true);
    }
  }, 120_000);

  it('lädt alle 14 Szenen mit dem produktiven Three.js-GLTFLoader', async () => {
    for (const configuration of AGE_REFERENCE_VARIANTS) {
      const generatedModel = generated(configuration.id);
      const arrayBuffer = generatedModel.bytes.buffer.slice(
        generatedModel.bytes.byteOffset,
        generatedModel.bytes.byteOffset + generatedModel.bytes.byteLength,
      ) as ArrayBuffer;
      const loaded = await new Promise<Awaited<ReturnType<GLTFLoader['loadAsync']>>>(
        (resolveLoaded, rejectLoaded) => {
          new GLTFLoader().parse(arrayBuffer, '', resolveLoaded, rejectLoaded);
        },
      );
      expect(loaded.scene.children).toHaveLength(generatedModel.summary.zones.length);
      expect(
        loaded.scene.children.filter(
          (object) => typeof object.userData.anatomicalZoneId === 'string',
        ),
      ).toHaveLength(generatedModel.summary.zones.length);
    }
  }, 120_000);
});
