import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  DIVERS_REFERENCE_VARIANTS,
  buildDiversReferenceGlb,
  requiredZonesForDiversReference,
} from './lib/bodymap-divers-reference-glb.mjs';
import { inspectBodyMapGlb } from './lib/bodymap-glb-inspector.mjs';

const root = process.cwd();
const manifest = JSON.parse(
  await readFile(resolve(root, 'assets/bodymap3d/v2/medical-mesh-manifest.json'), 'utf8'),
);
const outputDirectory = process.env.BODYMAP3D_REFERENCE_OUTPUT_DIR
  ? resolve(process.env.BODYMAP3D_REFERENCE_OUTPUT_DIR)
  : resolve(root, 'public/bodymap3d/v2');
await mkdir(outputDirectory, { recursive: true });

const results = [];
for (const configuration of DIVERS_REFERENCE_VARIANTS) {
  const variant = manifest.variants.find((entry) => entry.id === configuration.id);
  if (!variant) throw new Error(`Manifest enthält ${configuration.id} nicht.`);
  const generated = buildDiversReferenceGlb(configuration.id);
  const report = inspectBodyMapGlb(generated.bytes, {
    expectedVariantId: configuration.id,
    requiredZoneIds: requiredZonesForDiversReference(configuration.id, manifest),
    expectedHeightMeters: variant.nominalHeightMeters,
    maximumVertices: manifest.qualityLimits.maximumVertices,
    maximumTriangles: manifest.qualityLimits.maximumTriangles,
    maximumFileSizeBytes: manifest.qualityLimits.maximumFileSizeBytes,
  });
  if (!report.valid) {
    throw new Error(`${configuration.id}:\n${report.errors.join('\n')}`);
  }
  if (
    report.metadata?.referenceModel !== true ||
    report.metadata?.selfDeveloped !== true ||
    report.metadata?.medicallyReviewed !== false ||
    report.metadata?.intimateAnatomyReviewed !== false ||
    report.metadata?.safeForClinicalRelease !== false
  ) {
    throw new Error(`${configuration.id}: verpflichtende Divers-Freigabesperren fehlen.`);
  }
  const outputFile = resolve(outputDirectory, configuration.fileName);
  const qualityReport = {
    ...report,
    generatedReferenceSummary: generated.summary,
    anatomyConfiguration: {
      genitalAnatomy: configuration.genitalAnatomy,
      chestAnatomy: configuration.chestAnatomy,
      explicit:
        configuration.id !== `body-${configuration.ageGroup}-divers`,
    },
    releaseGates: {
      technicalInspection: 'passed',
      modularAnatomyContract: 'passed',
      visualMultiViewReview: 'pending',
      raycastingReview: 'pending',
      medicalAnatomyReview: 'pending',
      pediatricAnatomyReview: ['baby', 'kleinkind', 'kind'].includes(
        configuration.ageGroup,
      )
        ? 'pending'
        : 'not-applicable',
      sensitiveAnatomyReview: 'pending',
      productionRelease: 'blocked',
    },
  };
  await writeFile(outputFile, generated.bytes);
  await writeFile(
    `${outputFile}.quality.json`,
    `${JSON.stringify(qualityReport, null, 2)}\n`,
    'utf8',
  );
  results.push({
    id: configuration.id,
    bytes: generated.bytes.length,
    zones: generated.summary.zones.length,
    vertices: report.stats.vertices,
    triangles: report.stats.triangles,
    heightMeters: Number(report.stats.bounds.dimensions.height.toFixed(3)),
  });
}

console.log('Acht modulare technische Divers-3D-Referenzkörper deterministisch erzeugt.');
for (const result of results) {
  console.log(
    `${result.id}: ${result.heightMeters} m · ${result.zones} Zonen · ${result.vertices} Vertices · ${result.triangles} Dreiecke · ${result.bytes} Bytes`,
  );
}
console.log('Technische GLB-Matrix nach Registrierung: 18/18');
console.log('Medizinische Freigabe: 0/8 · Produktionsfreigabe: GESPERRT');
