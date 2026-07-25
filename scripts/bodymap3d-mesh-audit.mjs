import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
    }
    if (variant.reviewStatus === 'awaiting-mesh') {
      errors.push(`${variant.id}: vorhandenes Asset darf nicht awaiting-mesh bleiben.`);
    }
  } else if (variant.reviewStatus !== 'awaiting-mesh') {
    errors.push(`${variant.id}: Reviewstatus ohne registriertes GLB-Asset.`);
  }
}

if (errors.length) {
  console.error(`Bodymap-Mesh-Audit fehlgeschlagen (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const registeredAssets = variants.filter((entry) => entry.assetPath).length;
const releasedAssets = variants.filter(
  (entry) => entry.reviewStatus === 'released',
).length;

console.log('Bodymap-Mesh-Audit technisch bestanden.');
console.log(`Variantenvertrag: ${variants.length}/18`);
console.log(`Registrierte GLB-Meshes: ${registeredAssets}/18`);
console.log(`Medizinisch freigegeben: ${releasedAssets}/18`);
console.log(`Parametrischer Fallback aktiv: ${18 - registeredAssets}/18`);
