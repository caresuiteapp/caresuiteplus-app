import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../../../assets/bodymap3d/v2/medical-mesh-manifest.json';
import {
  DIVERS_REFERENCE_VARIANTS,
  buildDiversReferenceGlb,
  requiredZonesForDiversReference,
} from '../../../scripts/lib/bodymap-divers-reference-glb.mjs';
import { inspectBodyMapGlb } from '../../../scripts/lib/bodymap-glb-inspector.mjs';

const generatedByVariant = new Map<
  string,
  ReturnType<typeof buildDiversReferenceGlb>
>();

function generated(variantId: string) {
  const cached = generatedByVariant.get(variantId);
  if (cached) return cached;
  const value = buildDiversReferenceGlb(variantId);
  generatedByVariant.set(variantId, value);
  return value;
}

describe('14 modulare technische Divers-Referenzkörper', () => {
  it('schließt den 30-Variantenvertrag mit 14 eindeutigen Divers-GLBs', () => {
    expect(DIVERS_REFERENCE_VARIANTS).toHaveLength(14);
    expect(new Set(DIVERS_REFERENCE_VARIANTS.map((entry) => entry.id)).size).toBe(14);
    expect(manifest.variants.filter((entry) => entry.assetPath)).toHaveLength(30);
  });

  it('modelliert alle sechs expliziten Erwachsenen-Anatomiekombinationen getrennt', () => {
    expect(
      DIVERS_REFERENCE_VARIANTS.map((entry) => [
        entry.id,
        entry.genitalAnatomy,
        entry.chestAnatomy,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ['body-erwachsener-divers-penis-brueste', 'penis', 'brueste'],
        ['body-erwachsener-divers-vulva-keine-brueste', 'vulva', 'keine_brueste'],
        ['body-erwachsener-divers-unbekannt-brueste', 'unbekannt', 'brueste'],
        ['body-erwachsener-divers-penis-keine-brueste', 'penis', 'keine_brueste'],
        ['body-erwachsener-divers-vulva-brueste', 'vulva', 'brueste'],
        [
          'body-erwachsener-divers-unbekannt-keine-brueste',
          'unbekannt',
          'keine_brueste',
        ],
      ]),
    );
  });

  it.each(DIVERS_REFERENCE_VARIANTS)(
    'erzeugt $id deterministisch und mit gesperrter Freigabe',
    async (configuration) => {
      await new Promise<void>((resolveReady) => setTimeout(resolveReady, 0));
      const first = generated(configuration.id);
      expect(first.bytes.length).toBeGreaterThan(100_000);
      const variant = manifest.variants.find((entry) => entry.id === configuration.id)!;
      const report = inspectBodyMapGlb(first.bytes, {
        expectedVariantId: configuration.id,
        requiredZoneIds: requiredZonesForDiversReference(configuration.id, manifest),
        expectedHeightMeters: variant.nominalHeightMeters,
        maximumVertices: manifest.qualityLimits.maximumVertices,
        maximumTriangles: manifest.qualityLimits.maximumTriangles,
        maximumFileSizeBytes: manifest.qualityLimits.maximumFileSizeBytes,
      });
      expect(report.valid, report.errors.join('\n')).toBe(true);
      expect(report.metadata?.sexPhenotype).toBe('divers');
      expect(report.metadata?.genitalAnatomy).toBe(configuration.genitalAnatomy);
      expect(report.metadata?.chestAnatomy).toBe(configuration.chestAnatomy);
      expect(report.metadata?.safeForClinicalRelease).toBe(false);
    },
    20_000,
  );

  it('verwendet für unbekannte Genitalanatomie keine Penis- oder Vulva-Zonen', () => {
    for (const configuration of DIVERS_REFERENCE_VARIANTS.filter(
      (entry) => entry.genitalAnatomy === 'unbekannt',
    )) {
      const zones = generated(configuration.id).summary.zones;
      expect(zones).toContain('surface-pubic-region-unclassified');
      expect(zones).toContain('surface-genital-observation-deferred');
      expect(zones).not.toContain('surface-penis');
      expect(zones).not.toContain('surface-vaginal-opening');
    }
  }, 120_000);

  it('hält die eingecheckten öffentlichen GLBs bytegenau synchron', () => {
    for (const configuration of DIVERS_REFERENCE_VARIANTS) {
      const generatedBytes = generated(configuration.id).bytes;
      const committed = readFileSync(
        resolve(process.cwd(), 'public/bodymap3d/v2', configuration.fileName),
      );
      expect(committed.equals(generatedBytes)).toBe(true);
    }
  }, 120_000);
});
