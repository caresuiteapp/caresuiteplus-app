import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildBodyMapCalibrationGlb } from './lib/bodymap-calibration-glb.mjs';
import { inspectBodyMapGlb } from './lib/bodymap-glb-inspector.mjs';

function valueOf(name) {
  return process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(
    name.length + 3,
  );
}

const root = process.cwd();
const variantId = valueOf('variant') ?? 'body-erwachsener-maennlich';
const output = resolve(
  valueOf('output') ??
    'tests/fixtures/bodymap3d/body-erwachsener-maennlich-calibration.glb',
);
const manifest = JSON.parse(
  await readFile(resolve(root, 'assets/bodymap3d/v2/medical-mesh-manifest.json'), 'utf8'),
);
const variant = manifest.variants.find((entry) => entry.id === variantId);
if (!variant) throw new Error(`Unbekannte Variante: ${variantId}`);
const anatomyZones =
  variantId.includes('-maennlich') || variantId.includes('-penis-')
    ? manifest.requiredAnatomyZones.penis
    : variantId.includes('-weiblich') || variantId.includes('-vulva-')
      ? manifest.requiredAnatomyZones.vulva
      : [];
const zoneIds = [...manifest.requiredCoreZones, ...anatomyZones];
const bytes = buildBodyMapCalibrationGlb({
  variantId,
  nominalHeightMeters: variant.nominalHeightMeters,
  zoneIds,
});
const report = inspectBodyMapGlb(bytes, {
  expectedVariantId: variantId,
  requiredZoneIds: zoneIds,
  expectedHeightMeters: variant.nominalHeightMeters,
  maximumVertices: manifest.qualityLimits.maximumVertices,
  maximumTriangles: manifest.qualityLimits.maximumTriangles,
});
if (!report.valid) {
  throw new Error(`Kalibrierungs-GLB ist ungültig: ${report.errors.join('; ')}`);
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, bytes);
console.log(`Technische Kalibrierungsdatei erzeugt: ${output}`);
console.log('Nicht medizinisch verwenden oder als reales Körpermodell registrieren.');
