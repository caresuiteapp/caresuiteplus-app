import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspectBodyMapGlb } from './lib/bodymap-glb-inspector.mjs';

const root = process.cwd();
const meshManifest = JSON.parse(
  readFileSync(
    resolve(root, 'assets/bodymap3d/v2/medical-mesh-manifest.json'),
    'utf8',
  ),
);
const baseManifest = JSON.parse(
  readFileSync(resolve(root, 'assets/bodymap3d/v1/model-manifest.json'), 'utf8'),
);

const errors = [];
const variants = meshManifest.variants ?? [];
const ids = variants.map((entry) => entry.id);
const chestZonesFor = (variant) => {
  if (variant.chestZoneContract) {
    return meshManifest.requiredChestZones?.[variant.chestZoneContract] ?? [];
  }
  return variant.id.includes('-weiblich') || variant.id.includes('-brueste')
    ? meshManifest.requiredChestZones?.breasts ?? []
    : [];
};
const expectedExtraVariants = [
  'body-erwachsener-divers-penis-brueste',
  'body-erwachsener-divers-vulva-keine-brueste',
  'body-erwachsener-divers-unbekannt-brueste',
];
const expectedIds = [...baseManifest.baseModelIds, ...expectedExtraVariants];

if (meshManifest.schemaVersion !== 2) {
  errors.push('Das medizinische Mesh-Manifest muss Schema-Version 2 verwenden.');
}
if (meshManifest.meshContractVersion !== 1) {
  errors.push('Der erwartete medizinische Mesh-Vertrag ist Version 1.');
}
if (
  !Array.isArray(meshManifest.requiredCoreZones) ||
  meshManifest.requiredCoreZones.length < 20 ||
  new Set(meshManifest.requiredCoreZones).size !== meshManifest.requiredCoreZones.length
) {
  errors.push('Der V2-Vertrag benötigt mindestens 20 eindeutige anatomische Kernzonen.');
}
if (
  !(meshManifest.qualityLimits?.maximumVertices > 0) ||
  !(meshManifest.qualityLimits?.maximumTriangles > 0) ||
  !(meshManifest.qualityLimits?.maximumFileSizeBytes > 0)
) {
  errors.push('Die V2-Qualitätsbudgets sind unvollständig.');
}
if (variants.length !== 18 || new Set(ids).size !== 18) {
  errors.push('Die medizinische Mesh-Matrix muss genau 18 eindeutige Varianten enthalten.');
}
for (const id of expectedIds) {
  if (!ids.includes(id)) errors.push(`Medizinische Mesh-Variante fehlt: ${id}`);
}

for (const variant of variants) {
  if (!baseManifest.baseModelIds.includes(variant.baseModelId)) {
    errors.push(`${variant.id}: unbekanntes Grundmodell ${variant.baseModelId}.`);
  }
  if (variant.meshContractVersion !== meshManifest.meshContractVersion) {
    errors.push(`${variant.id}: abweichende Mesh-Vertragsversion.`);
  }
  if (!(variant.nominalHeightMeters > 0)) {
    errors.push(`${variant.id}: ungültige Nennkörpergröße.`);
  }
  if (variant.assetPath) {
    if (!variant.assetPath.startsWith('/bodymap3d/v2/')) {
      errors.push(`${variant.id}: assetPath muss unter /bodymap3d/v2/ liegen.`);
    }
    const localAsset = resolve(root, 'public', variant.assetPath.replace(/^\/+/, ''));
    if (!existsSync(localAsset)) {
      errors.push(`${variant.id}: registrierte GLB-Datei fehlt: ${variant.assetPath}`);
    } else {
      const anatomyZones = variant.id.includes('-maennlich') || variant.id.includes('-penis-')
        ? meshManifest.requiredAnatomyZones.penis
        : variant.id.includes('-weiblich') || variant.id.includes('-vulva-')
          ? meshManifest.requiredAnatomyZones.vulva
          : [];
      const chestZones = chestZonesFor(variant);
      const report = inspectBodyMapGlb(readFileSync(localAsset), {
        expectedVariantId: variant.id,
        requiredZoneIds: [...meshManifest.requiredCoreZones, ...anatomyZones, ...chestZones],
        expectedHeightMeters: variant.nominalHeightMeters,
        maximumVertices: meshManifest.qualityLimits.maximumVertices,
        maximumTriangles: meshManifest.qualityLimits.maximumTriangles,
        maximumFileSizeBytes: meshManifest.qualityLimits.maximumFileSizeBytes,
      });
      for (const error of report.errors) {
        errors.push(`${variant.id}: ${error}`);
      }
      if (variant.selfDeveloped === true) {
        if (
          report.metadata?.selfDeveloped !== true ||
          report.metadata?.referenceModel !== true
        ) {
          errors.push(`${variant.id}: selbst entwickeltes Referenzmodell ist nicht eindeutig markiert.`);
        }
        if (
          report.metadata?.medicallyReviewed !== false ||
          report.metadata?.safeForClinicalRelease !== false ||
          variant.medicalReleaseBlocked !== true
        ) {
          errors.push(`${variant.id}: medizinische Freigabesperre ist unvollständig.`);
        }
      }
    }
    if (!variant.qualityReportPath) {
      errors.push(`${variant.id}: Qualitätsbericht fehlt im Manifest.`);
    } else {
      const localReport = resolve(
        root,
        'public',
        variant.qualityReportPath.replace(/^\/+/, ''),
      );
      if (!existsSync(localReport)) {
        errors.push(`${variant.id}: Qualitätsbericht fehlt: ${variant.qualityReportPath}`);
      } else if (existsSync(localAsset)) {
        try {
          const savedReport = JSON.parse(readFileSync(localReport, 'utf8'));
          const currentReport = inspectBodyMapGlb(readFileSync(localAsset), {
            expectedVariantId: variant.id,
            requiredZoneIds: [
              ...meshManifest.requiredCoreZones,
              ...(variant.id.includes('-maennlich') || variant.id.includes('-penis-')
                ? meshManifest.requiredAnatomyZones.penis
                : variant.id.includes('-weiblich') || variant.id.includes('-vulva-')
                  ? meshManifest.requiredAnatomyZones.vulva
                  : []),
              ...chestZonesFor(variant),
            ],
            expectedHeightMeters: variant.nominalHeightMeters,
            maximumVertices: meshManifest.qualityLimits.maximumVertices,
            maximumTriangles: meshManifest.qualityLimits.maximumTriangles,
            maximumFileSizeBytes: meshManifest.qualityLimits.maximumFileSizeBytes,
          });
          if (
            savedReport.valid !== true ||
            savedReport.stats?.bytes !== currentReport.stats?.bytes ||
            savedReport.stats?.vertices !== currentReport.stats?.vertices ||
            savedReport.stats?.triangles !== currentReport.stats?.triangles ||
            savedReport.metadata?.variantId !== variant.id
          ) {
            errors.push(`${variant.id}: Qualitätsbericht ist nicht synchron zum GLB-Asset.`);
          }
        } catch (error) {
          errors.push(`${variant.id}: Qualitätsbericht ist ungültig: ${String(error)}`);
        }
      }
    }
    if (variant.reviewStatus === 'awaiting-mesh') {
      errors.push(`${variant.id}: vorhandenes Asset darf nicht awaiting-mesh bleiben.`);
    }
  } else if (variant.reviewStatus !== 'awaiting-mesh') {
    errors.push(`${variant.id}: Reviewstatus ohne registriertes GLB-Asset.`);
  }
}

const calibrationPath = resolve(
  root,
  'tests/fixtures/bodymap3d/body-erwachsener-maennlich-calibration.glb',
);
if (!existsSync(calibrationPath)) {
  errors.push('Die technische GLB-Kalibrierungsdatei fehlt.');
} else {
  const calibrationReport = inspectBodyMapGlb(readFileSync(calibrationPath), {
    expectedVariantId: 'body-erwachsener-maennlich',
    requiredZoneIds: [
      ...meshManifest.requiredCoreZones,
      ...meshManifest.requiredAnatomyZones.penis,
    ],
    expectedHeightMeters: 1.72,
    maximumVertices: meshManifest.qualityLimits.maximumVertices,
    maximumTriangles: meshManifest.qualityLimits.maximumTriangles,
    maximumFileSizeBytes: meshManifest.qualityLimits.maximumFileSizeBytes,
  });
  for (const error of calibrationReport.errors) {
    errors.push(`Kalibrierungsdatei: ${error}`);
  }
  if (
    calibrationReport.metadata?.calibrationOnly !== true ||
    calibrationReport.metadata?.medicallyReviewed !== false
  ) {
    errors.push(
      'Die Kalibrierungsdatei muss calibrationOnly=true und medicallyReviewed=false tragen.',
    );
  }
}

if (errors.length) {
  console.error(`Bodymap-Mesh-Audit fehlgeschlagen (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const registeredAssets = variants.filter((entry) => entry.assetPath).length;
const technicalReferences = variants.filter(
  (entry) => entry.assetPath && entry.reviewStatus === 'technical-review',
).length;
const releasedAssets = variants.filter(
  (entry) => entry.reviewStatus === 'released',
).length;

console.log('Bodymap-Mesh-Audit technisch bestanden.');
console.log(`Variantenvertrag: ${variants.length}/18`);
console.log(`Registrierte GLB-Meshes: ${registeredAssets}/18`);
console.log(`Technische Referenzmeshes: ${technicalReferences}/18`);
console.log(`Medizinisch freigegeben: ${releasedAssets}/18`);
console.log(`Produktiver parametrischer Fallback aktiv: ${18 - releasedAssets}/18`);
