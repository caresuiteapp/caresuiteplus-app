import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { inspectBodyMapGlb } from './lib/bodymap-glb-inspector.mjs';

function valueOf(name) {
  return process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(
    name.length + 3,
  );
}

const sourceFile = valueOf('file');
const variantId = valueOf('variant');
const requestedStatus = valueOf('status') ?? 'technical-review';
const write = process.argv.includes('--write');
const allowedStatuses = ['technical-review', 'medical-review', 'released'];

if (!sourceFile || !variantId || !allowedStatuses.includes(requestedStatus)) {
  console.error(
    'Aufruf: node scripts/register-bodymap-glb.mjs --file=/pfad/modell.glb --variant=<id> --status=technical-review [--write]',
  );
  process.exit(2);
}
if (requestedStatus === 'released') {
  console.error(
    'Direkte Registrierung als released ist gesperrt. Medizinische Freigaben werden separat dokumentiert.',
  );
  process.exit(2);
}

const root = process.cwd();
const manifestPath = resolve(root, 'assets/bodymap3d/v2/medical-mesh-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const variantIndex = manifest.variants.findIndex((entry) => entry.id === variantId);
if (variantIndex < 0) {
  console.error(`Unbekannte Bodymap-Variante: ${variantId}`);
  process.exit(2);
}
const variant = manifest.variants[variantIndex];
const requiredZones = [
  ...manifest.requiredCoreZones,
  ...(variantId.includes('-maennlich') || variantId.includes('-penis-')
    ? manifest.requiredAnatomyZones.penis
    : []),
  ...(variantId.includes('-weiblich') || variantId.includes('-vulva-')
    ? manifest.requiredAnatomyZones.vulva
    : []),
];
const sourceBytes = await readFile(resolve(sourceFile));
const report = inspectBodyMapGlb(sourceBytes, {
  expectedVariantId: variantId,
  requiredZoneIds: requiredZones,
  expectedHeightMeters: variant.nominalHeightMeters,
  maximumVertices: manifest.qualityLimits.maximumVertices,
  maximumTriangles: manifest.qualityLimits.maximumTriangles,
  maximumFileSizeBytes: manifest.qualityLimits.maximumFileSizeBytes,
});
if (!report.valid) {
  console.error(`Registrierung abgebrochen: ${report.errors.length} Qualitätsfehler.`);
  for (const error of report.errors) console.error(`- ${error}`);
  process.exit(1);
}

const version = Number(variant.version ?? 0) + 1;
const filename = `${variantId}-v${version}.glb`;
const relativeAssetPath = `/bodymap3d/v2/${filename}`;
const targetFile = resolve(root, 'public/bodymap3d/v2', filename);
const reportFile = resolve(root, 'public/bodymap3d/v2', `${filename}.quality.json`);

console.log(`Quelle: ${resolve(sourceFile)}`);
console.log(`Variante: ${variantId}`);
console.log(`Ziel: ${relativeAssetPath}`);
console.log(`Status: ${requestedStatus}`);
console.log(`Vertices/Dreiecke: ${report.stats.vertices}/${report.stats.triangles}`);

if (!write) {
  console.log('\nDRY-RUN: Keine Datei und kein Manifest wurden verändert.');
  console.log('Nach fachlicher Kontrolle denselben Aufruf mit --write wiederholen.');
  process.exit(0);
}

await mkdir(resolve(root, 'public/bodymap3d/v2'), { recursive: true });
await copyFile(resolve(sourceFile), targetFile);
await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
manifest.variants[variantIndex] = {
  ...variant,
  assetPath: relativeAssetPath,
  version,
  reviewStatus: requestedStatus,
  sourceFileName: basename(sourceFile),
  qualityReportPath: `${relativeAssetPath}.quality.json`,
  registeredAt: new Date().toISOString(),
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log('\nGLB-Datei wurde registriert. Vor einem Commit sind Audit und Visual-QA Pflicht.');
