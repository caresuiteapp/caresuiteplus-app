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

describe('acht modulare technische Divers-Referenzkörper', () => {
  it('schließt den 18-Variantenvertrag mit acht eindeutigen Divers-GLBs', () => {
    expect(DIVERS_REFERENCE_VARIANTS).toHaveLength(8);
    expect(new Set(DIVERS_REFERENCE_VARIANTS.map((entry) => entry.id)).size).toBe(8);
    expect(manifest.variants.filter((entry) => entry.assetPath)).toHaveLength(18);
  });

  it('modelliert die drei expliziten Erwachsenen-Anatomiekombinationen getrennt', () => {
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
      ]),
    );
  });

  it('erzeugt alle acht GLBs deterministisch und mit gesperrter Freigabe', () => {
    for (const configuration of DIVERS_REFERENCE_VARIANTS) {
      const first = buildDiversReferenceGlb(configuration.id);
      const second = buildDiversReferenceGlb(configuration.id);
      expect(first.bytes.equals(second.bytes)).toBe(true);
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
    }
  });

  it('verwendet für unbekannte Genitalanatomie keine Penis- oder Vulva-Zonen', () => {
    for (const configuration of DIVERS_REFERENCE_VARIANTS.filter(
      (entry) => entry.genitalAnatomy === 'unbekannt',
    )) {
      const zones = buildDiversReferenceGlb(configuration.id).summary.zones;
      expect(zones).toContain('surface-pubic-region-unclassified');
      expect(zones).toContain('surface-genital-observation-deferred');
      expect(zones).not.toContain('surface-penis');
      expect(zones).not.toContain('surface-vaginal-opening');
    }
  });

  it('hält die eingecheckten öffentlichen GLBs bytegenau synchron', () => {
    for (const configuration of DIVERS_REFERENCE_VARIANTS) {
      const generated = buildDiversReferenceGlb(configuration.id).bytes;
      const committed = readFileSync(
        resolve(process.cwd(), 'public/bodymap3d/v2', configuration.fileName),
      );
      expect(committed.equals(generated)).toBe(true);
    }
  });
});
