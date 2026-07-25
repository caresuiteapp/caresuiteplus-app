import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(resolve(root, 'assets/bodymap3d/v1/model-manifest.json'), 'utf8'),
);
const modelSource = readFileSync(
  resolve(root, 'src/components/pflege/bodyMap3d/ParametricBodyModel.tsx'),
  'utf8',
);

const errors = [];
const expectedAges = ['baby', 'kleinkind', 'kind', 'junger-erwachsener', 'erwachsener'];
const expectedSexes = ['maennlich', 'weiblich', 'divers'];

if (new Set(manifest.baseModelIds).size !== 15) {
  errors.push('Die Manifest-Matrix muss genau 15 eindeutige Grundmodelle enthalten.');
}
for (const age of expectedAges) {
  for (const sex of expectedSexes) {
    const id = `body-${age}-${sex}`;
    if (!manifest.baseModelIds.includes(id)) errors.push(`Grundmodell fehlt: ${id}`);
  }
}
if (new Set(manifest.diversAnatomyPacks).size !== 3) {
  errors.push('Es müssen genau drei Divers-Anatomiepakete registriert sein.');
}
for (const surface of manifest.requiredClinicalSurfaces) {
  if (!modelSource.includes(surface)) errors.push(`Klinische Oberfläche fehlt: ${surface}`);
}
for (const generator of manifest.requiredClinicalGenerators ?? []) {
  if (!modelSource.includes(generator)) {
    errors.push(`Klinischer Oberflächengenerator fehlt: ${generator}`);
  }
}
for (const anchorContract of [
  'bodymap-model-root',
  'modelPosition',
  'modelNormal',
  'worldPosition',
  'localPosition',
]) {
  if (!modelSource.includes(anchorContract)) {
    errors.push(`3D-Ankervertrag fehlt: ${anchorContract}`);
  }
}

if (errors.length > 0) {
  console.error(`Bodymap-3D-Audit fehlgeschlagen (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const pendingReviews = Object.entries(manifest.medicalAcceptance)
  .filter(([, accepted]) => accepted !== true)
  .map(([name]) => name);

console.log('Bodymap-3D-Audit technisch bestanden.');
console.log(`Grundmodelle: ${manifest.baseModelIds.length}`);
console.log(`Divers-Anatomiepakete: ${manifest.diversAnatomyPacks.length}`);
console.log(`Pflichtoberflächen: ${manifest.requiredClinicalSurfaces.length}`);
console.log(`Medizinische Freigaben ausstehend: ${pendingReviews.join(', ')}`);
