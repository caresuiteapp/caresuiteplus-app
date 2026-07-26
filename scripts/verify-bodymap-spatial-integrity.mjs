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

async function loadGlb(assetPath) {
  const bytes = await readFile(`public${assetPath}`);
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(arrayBuffer, '', resolve, reject);
  });
}

function isLegacyInteractionMesh(object) {
  return (
    object.userData?.bodymapInteractionProxy === true ||
    object.userData?.technicalReference === true ||
    typeof object.userData?.anatomicalZoneId === 'string' ||
    typeof object.userData?.zoneId === 'string' ||
    object.name.startsWith('zone__')
  );
}

for (const variant of manifest.variants) {
  const [visual, interaction] = await Promise.all([
    loadGlb(variant.visualAssetPath),
    loadGlb(variant.interactionAssetPath),
  ]);

  visual.scene.updateMatrixWorld(true);
  interaction.scene.updateMatrixWorld(true);

  const body = visual.scene.getObjectByName('real-human-body');
  if (!body?.isMesh) {
    failures.push(`${variant.id}: sichtbarer Hauptkörper fehlt`);
    continue;
  }

  const bodyBounds = new Box3().setFromObject(body);
  const allowedBounds = bodyBounds
    .clone()
    .expandByScalar(variant.nominalHeightMeters * 0.13);
  const oversizedLimit = variant.nominalHeightMeters * 0.16;
  let visualParts = 0;
  visual.scene.traverse((object) => {
    if (!object.isMesh || object === body) return;
    visualParts += 1;
    const bounds = new Box3().setFromObject(object);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    if (!allowedBounds.containsPoint(center)) {
      failures.push(
        `${variant.id}: ${object.name} schwebt außerhalb des Körperraums`,
      );
    }
    if (Math.max(size.x, size.y, size.z) > oversizedLimit) {
      failures.push(
        `${variant.id}: ${object.name} ist unplausibel groß (${Math.max(
          size.x,
          size.y,
          size.z,
        ).toFixed(3)} m)`,
      );
    }
  });

  let interactionParts = 0;
  interaction.scene.traverse((object) => {
    if (!object.isMesh) return;
    interactionParts += 1;
    if (!isLegacyInteractionMesh(object)) {
      failures.push(
        `${variant.id}: ${object.name} ist nicht als unsichtbare Trefferfläche erkennbar`,
      );
    }
  });

  console.log(
    `${variant.id}: ${visualParts} sichtbare Anatomieteile · ${interactionParts} unsichtbare Trefferflächen`,
  );
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Räumliche Integritätsprüfung erfolgreich: ${manifest.variants.length} Varianten.`,
  );
}
