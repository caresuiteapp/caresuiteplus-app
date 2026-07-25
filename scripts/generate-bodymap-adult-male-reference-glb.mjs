import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildAdultMaleReferenceGlb } from './lib/bodymap-adult-male-reference-glb.mjs';
import { inspectBodyMapGlb } from './lib/bodymap-glb-inspector.mjs';

const root = process.cwd();
const manifest = JSON.parse(
  await readFile(resolve(root, 'assets/bodymap3d/v2/medical-mesh-manifest.json'), 'utf8'),
);
const variantId = 'body-erwachsener-maennlich';
const variant = manifest.variants.find((entry) => entry.id === variantId);
if (!variant) {
  throw new Error(`Manifest enthält die Referenzvariante ${variantId} nicht.`);
}

const generated = buildAdultMaleReferenceGlb();
const requiredZoneIds = [
  ...manifest.requiredCoreZones,
  ...manifest.requiredAnatomyZones.penis,
];
const report = inspectBodyMapGlb(generated.bytes, {
  expectedVariantId: variantId,
  requiredZoneIds,
  expectedHeightMeters: variant.nominalHeightMeters,
  maximumVertices: manifest.qualityLimits.maximumVertices,
  maximumTriangles: manifest.qualityLimits.maximumTriangles,
  maximumFileSizeBytes: manifest.qualityLimits.maximumFileSizeBytes,
});

if (!report.valid) {
  console.error('Der erzeugte Referenzkörper hat die GLB-Prüfung nicht bestanden.');
  for (const error of report.errors) console.error(`- ${error}`);
  process.exit(1);
}
if (
  report.metadata?.referenceModel !== true ||
  report.metadata?.selfDeveloped !== true ||
  report.metadata?.medicallyReviewed !== false ||
  report.metadata?.safeForClinicalRelease !== false
) {
  console.error('Die verpflichtenden technischen Freigabesperren fehlen im GLB.');
  process.exit(1);
}

const outputDirectory = resolve(root, 'public/bodymap3d/v2');
const outputFile = resolve(outputDirectory, 'body-erwachsener-maennlich-v2.glb');
const qualityFile = resolve(
  outputDirectory,
  'body-erwachsener-maennlich-v2.glb.quality.json',
);
const qualityReport = {
  ...report,
  generatedReferenceSummary: generated.summary,
  releaseGates: {
    technicalInspection: 'passed',
    visualFourViewReview: 'pending',
    raycastingReview: 'pending',
    medicalAnatomyReview: 'pending',
    sensitiveAnatomyReview: 'pending',
    productionRelease: 'blocked',
  },
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputFile, generated.bytes);
await writeFile(qualityFile, `${JSON.stringify(qualityReport, null, 2)}\n`, 'utf8');

console.log('Selbst entwickelter Referenzkörper wurde deterministisch erzeugt.');
console.log(`Datei: ${outputFile}`);
console.log(`Körperzonen: ${generated.summary.zones.length}`);
console.log(`Vertices: ${report.stats.vertices}`);
console.log(`Dreiecke: ${report.stats.triangles}`);
console.log('Medizinische Freigabe: NEIN');
console.log('Produktionsfreigabe: GESPERRT');
