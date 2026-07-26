import { readFile } from 'node:fs/promises';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ({
  width: 128,
  height: 128,
  close() {},
});

const manifest = JSON.parse(
  await readFile('assets/bodymap3d/v3/real-human-manifest.json', 'utf8'),
);
const failures = [];

async function loadVariant(variant) {
  const bytes = await readFile(`public${variant.visualAssetPath}`);
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(arrayBuffer, '', resolve, reject);
  });
}

function centerHeightRatio(scene, name, nominalHeightMeters) {
  const object = scene.getObjectByName(name);
  if (!object?.isMesh) return null;
  object.updateMatrixWorld(true);
  const center = new Box3().setFromObject(object).getCenter(new Vector3());
  return center.y / nominalHeightMeters;
}

function requireRange(variant, scene, name, minimum, maximum) {
  const ratio = centerHeightRatio(
    scene,
    name,
    variant.nominalHeightMeters,
  );
  if (ratio === null) {
    failures.push(`${variant.id}: ${name} fehlt`);
    return;
  }
  if (ratio < minimum || ratio > maximum) {
    failures.push(
      `${variant.id}: ${name} liegt bei ${(ratio * 100).toFixed(1)} % statt ${(
        minimum * 100
      ).toFixed(1)}–${(maximum * 100).toFixed(1)} % der Körperhöhe`,
    );
  }
}

for (const variant of manifest.variants) {
  const loaded = await loadVariant(variant);
  loaded.scene.updateMatrixWorld(true);

  requireRange(
    variant,
    loaded.scene,
    'real-human-nipple-left',
    0.7,
    0.74,
  );
  requireRange(
    variant,
    loaded.scene,
    'real-human-nipple-right',
    0.7,
    0.74,
  );
  requireRange(variant, loaded.scene, 'real-human-anus', 0.47, 0.5);

  const penis = loaded.scene.getObjectByName('real-human-penis');
  if (penis) {
    requireRange(variant, loaded.scene, 'real-human-penis', 0.46, 0.51);
    requireRange(variant, loaded.scene, 'real-human-glans', 0.43, 0.49);
    requireRange(
      variant,
      loaded.scene,
      'real-human-coronal-ridge',
      0.44,
      0.5,
    );
    requireRange(
      variant,
      loaded.scene,
      'real-human-urethral-opening',
      0.41,
      0.49,
    );
    requireRange(
      variant,
      loaded.scene,
      'real-human-scrotum-left',
      0.43,
      0.5,
    );
    requireRange(
      variant,
      loaded.scene,
      'real-human-scrotum-right',
      0.43,
      0.5,
    );
  }

  const vulva = loaded.scene.getObjectByName('real-human-labium-majus-left');
  if (vulva) {
    requireRange(
      variant,
      loaded.scene,
      'real-human-labium-majus-left',
      0.45,
      0.52,
    );
    requireRange(
      variant,
      loaded.scene,
      'real-human-labium-majus-right',
      0.45,
      0.52,
    );
  }

  loaded.scene.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      if (!material) continue;
      if (material.transparent || material.opacity < 0.999) {
        failures.push(
          `${variant.id}: ${object.name}/${material.name} ist nicht vollständig opak`,
        );
      }
    }
  });

  console.log(
    `${variant.id}: Anatomieanker und opake Oberflächen geprüft`,
  );
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Anatomische Ausrichtungsprüfung erfolgreich: ${manifest.variants.length} Varianten.`,
  );
}
