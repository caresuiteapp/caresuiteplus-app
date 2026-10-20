import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildAdultFemaleReferenceGlb } from './lib/bodymap-adult-female-reference-glb.mjs';
import { inspectBodyMapGlb } from './lib/bodymap-glb-inspector.mjs';

const root = process.cwd();
const manifest = JSON.parse(
  await readFile(resolve(root, 'assets/bodymap3d/v2/medical-mesh-manifest.json'), 'utf8'),
);
const variantId = 'body-erwachsener-weiblich';
const variant = manifest.variants.find((entry) => entry.id === variantId);
if (!variant) {
  throw new Error(`Manifest enthält die Referenzvariante ${variantId} nicht.`);
}

const generated = buildAdultFemaleReferenceGlb();
const requiredZoneIds = [
  ...manifest.requiredCoreZones,
  ...manifest.requiredAnatomyZones.vulva,
  ...manifest.requiredChestZones.breasts,
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
  console.error('Der erzeugte weibliche Referenzkörper hat die GLB-Prüfung nicht bestanden.');
  for (const error of report.errors) console.error(`- ${error}`);
  process.exit(1);
}
if (
  report.metadata?.referenceModel !== true ||
  report.metadata?.selfDeveloped !== true ||
  report.metadata?.medicallyReviewed !== false ||
  report.metadata?.safeForClinicalRelease !== false
) {
  console.error('Die verpflichtenden technischen Freigabesperren fehlen im weiblichen GLB.');
  process.exit(1);
}

const outputDirectory = process.env.BODYMAP3D_REFERENCE_OUTPUT_DIR
  ? resolve(process.env.BODYMAP3D_REFERENCE_OUTPUT_DIR)
  : resolve(root, 'public/bodymap3d/v2');
const outputFile = resolve(outputDirectory, 'body-erwachsener-weiblich-v2.glb');
const qualityFile = `${outputFile}.quality.json`;
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

console.log('Selbst entwickelter weiblicher Referenzkörper wurde deterministisch erzeugt.');
console.log(`Datei: ${outputFile}`);
console.log(`Körperzonen: ${generated.summary.zones.length}`);
console.log(`Vertices: ${report.stats.vertices}`);
console.log(`Dreiecke: ${report.stats.triangles}`);
console.log('Medizinische Freigabe: NEIN');
console.log('Produktionsfreigabe: GESPERRT');
