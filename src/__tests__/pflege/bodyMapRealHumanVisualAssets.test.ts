import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import manifest from '../../../assets/bodymap3d/v3/real-human-manifest.json';
import { inspectBodyMapGlb } from '../../../scripts/lib/bodymap-glb-inspector.mjs';
import {
  REAL_HUMAN_VISUAL_VARIANTS,
  canRenderRealHumanVisual,
} from '@/lib/pflege/bodyMap3d/medicalMeshCatalog';

Object.assign(globalThis, {
  self: globalThis,
  createImageBitmap:
    globalThis.createImageBitmap ??
    (async () => ({ width: 128, height: 128, close() {} })),
});

const readVariant = (visualAssetPath: string) =>
  readFileSync(resolve(process.cwd(), `public${visualAssetPath}`));

describe('Phase 11 Real-Human-Visual-Assets', () => {
  it('registriert 30 eindeutige, lokale und CC0-basierte Human-Varianten', () => {
    expect(manifest.variants).toHaveLength(30);
    expect(new Set(manifest.variants.map((entry) => entry.id)).size).toBe(30);
    expect(manifest.source.license).toBe('CC0-1.0');
    expect(manifest.qualityGate.medicalReviewStillRequired).toBe(true);

    for (const definition of REAL_HUMAN_VISUAL_VARIANTS) {
      expect(definition.visualAssetPath).toMatch(
        /^\/bodymap3d\/v3\/real-human\/.+-real-v3\.glb$/,
      );
      expect(definition.interactionAssetPath).toMatch(
        /^\/bodymap3d\/v2\/.+-v2\.glb$/,
      );
      expect(definition.medicalReviewStatus).toBe('pending');
      expect(canRenderRealHumanVisual(definition)).toBe(true);
      expect(readVariant(definition.visualAssetPath).length).toBe(
        definition.fileSizeBytes,
      );
    }
  });

  it('besteht für alle 30 GLBs Format-, Maß-, Boden- und Budgetprüfung', () => {
    for (const definition of manifest.variants) {
      const report = inspectBodyMapGlb(readVariant(definition.visualAssetPath), {
        expectedVariantId: definition.id,
        expectedHeightMeters: definition.nominalHeightMeters,
        maximumVertices: 25_000,
        maximumTriangles: 40_000,
        maximumFileSizeBytes: manifest.qualityGate.maximumFileSizeBytes,
      });
      expect(report.errors, definition.id).toEqual([]);
      expect(report.valid, definition.id).toBe(true);
      expect(report.stats?.vertices).toBe(definition.vertices);
      expect(report.stats?.triangles).toBe(definition.triangles);
      expect(report.stats?.textures).toBe(3);
      expect(report.stats?.images).toBe(3);
      expect(report.metadata).toMatchObject({
        visualProductionCandidate: true,
        medicallyReviewed: false,
        safeForClinicalRelease: false,
        sourceLicense: 'CC0-1.0',
      });
    }
  });

  it('lädt Körper, Sklera, Iris, Pupille und Munddetails im produktiven Loader', async () => {
    const definition = manifest.variants.find(
      (entry) => entry.id === 'body-erwachsener-maennlich',
    );
    expect(definition).toBeDefined();
    const bytes = readVariant(definition!.visualAssetPath);
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const loaded = await new Promise<Awaited<ReturnType<GLTFLoader['loadAsync']>>>(
      (resolveLoaded, rejectLoaded) => {
        new GLTFLoader().parse(arrayBuffer, '', resolveLoaded, rejectLoaded);
      },
    );
    const names: string[] = [];
    loaded.scene.traverse((object) => names.push(object.name));
    expect(names).toEqual(
      expect.arrayContaining([
        'real-human-body',
        'real-human-eye-left',
        'real-human-eye-right',
        'real-human-iris-left',
        'real-human-iris-right',
        'real-human-pupil-left',
        'real-human-pupil-right',
        'real-human-upper-teeth',
        'real-human-lower-teeth',
      ]),
    );
  });
});
