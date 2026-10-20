import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  formatBodyMapGlbReport,
  inspectBodyMapGlb,
} from './lib/bodymap-glb-inspector.mjs';

function valueOf(name) {
  return process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(
    name.length + 3,
  );
}

const file = valueOf('file');
const variantId = valueOf('variant');
const jsonOutput = valueOf('json');
if (!file || !variantId) {
  console.error(
    'Aufruf: node scripts/validate-bodymap-glb.mjs --file=/pfad/modell.glb --variant=body-erwachsener-maennlich [--json=bericht.json]',
  );
  process.exit(2);
}

const root = process.cwd();
const manifest = JSON.parse(
  await readFile(resolve(root, 'assets/bodymap3d/v2/medical-mesh-manifest.json'), 'utf8'),
);
const variant = manifest.variants.find((entry) => entry.id === variantId);
if (!variant) {
  console.error(`Unbekannte Bodymap-Variante: ${variantId}`);
  process.exit(2);
}

const requiredZones = [
  ...manifest.requiredCoreZones,
  ...(variantId.includes('-maennlich') || variantId.includes('-penis-')
    ? manifest.requiredAnatomyZones.penis
    : []),
  ...(variantId.includes('-weiblich') || variantId.includes('-vulva-')
    ? manifest.requiredAnatomyZones.vulva
    : []),
];
const report = inspectBodyMapGlb(await readFile(resolve(file)), {
  expectedVariantId: variantId,
  requiredZoneIds: requiredZones,
  expectedHeightMeters: variant.nominalHeightMeters,
  maximumVertices: manifest.qualityLimits.maximumVertices,
  maximumTriangles: manifest.qualityLimits.maximumTriangles,
  maximumFileSizeBytes: manifest.qualityLimits.maximumFileSizeBytes,
});

console.log(formatBodyMapGlbReport(report));
if (jsonOutput) {
  await writeFile(resolve(jsonOutput), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (!report.valid) process.exit(1);
