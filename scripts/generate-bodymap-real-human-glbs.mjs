import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { buildRealHumanGlb, REAL_HUMAN_SOURCE } from './lib/bodymap-real-human-glb.mjs';

const root = process.cwd();
const legacyManifest = JSON.parse(
  await readFile(resolve(root, 'assets/bodymap3d/v2/medical-mesh-manifest.json'), 'utf8'),
);
const outputDirectory = resolve(root, 'public/bodymap3d/v3/real-human');
const manifestPath = resolve(root, 'assets/bodymap3d/v3/real-human-manifest.json');
await mkdir(outputDirectory, { recursive: true });

const variants = [];
for (const legacy of legacyManifest.variants) {
  const generated = await buildRealHumanGlb({
    variantId: legacy.id,
    nominalHeightMeters: legacy.nominalHeightMeters,
  });
  const fileName = `${legacy.id}-real-v3.glb`;
  await writeFile(resolve(outputDirectory, fileName), generated.bytes);
  variants.push({
    id: legacy.id,
    baseModelId: legacy.baseModelId,
    visualAssetPath: `/bodymap3d/v3/real-human/${fileName}`,
    assetSha256: createHash('sha256').update(generated.bytes).digest('hex'),
    interactionAssetPath: legacy.assetPath,
    nominalHeightMeters: legacy.nominalHeightMeters,
    visualStatus: 'production-candidate',
    medicalReviewStatus: 'pending',
    sourceLicense: generated.summary.sourceLicense,
    vertices: generated.summary.vertices,
    triangles: generated.summary.triangles,
    fileSizeBytes: generated.bytes.length,
    morphPlan: generated.summary.morphPlan,
  });
  console.log(
    `${legacy.id}: ${generated.summary.vertices} Vertices · ${generated.summary.triangles} Dreiecke`,
  );
}

await writeFile(
  manifestPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      visualAssetContractVersion: 1,
      release: 'bodymap3d-v3-real-human-production-candidates',
      source: REAL_HUMAN_SOURCE,
      coordinateSystem: legacyManifest.coordinateSystem,
      qualityGate: {
        visualStatusRequiredForRuntime: 'production-candidate',
        medicalReviewStillRequired: true,
        interactionContractInheritedFrom: 'bodymap3d-v2',
        maximumFileSizeBytes: 15000000,
      },
      variants,
    },
    null,
    2,
  )}\n`,
  'utf8',
);
console.log(`Real-Human-Manifest: ${variants.length} Varianten`);
