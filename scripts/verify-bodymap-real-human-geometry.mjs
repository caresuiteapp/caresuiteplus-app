import { readFile } from 'node:fs/promises';
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

for (const variant of manifest.variants) {
  const bytes = await readFile(`public${variant.visualAssetPath}`);
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  const loaded = await new Promise((resolve, reject) => {
    new GLTFLoader().parse(arrayBuffer, '', resolve, reject);
  });
  const body = loaded.scene.getObjectByName('real-human-body');
  if (!body?.isMesh) {
    failures.push(`${variant.id}: zusammenhängende Körperoberfläche fehlt`);
    continue;
  }
  const position = body.geometry.getAttribute('position');
  const indices = body.geometry.index;
  let maximumEdge = 0;
  let invalidValues = 0;
  for (let index = 0; index < position.count; index += 1) {
    if (
      !Number.isFinite(position.getX(index)) ||
      !Number.isFinite(position.getY(index)) ||
      !Number.isFinite(position.getZ(index))
    ) {
      invalidValues += 1;
    }
  }
  for (let offset = 0; offset < indices.count; offset += 3) {
    for (const [fromOffset, toOffset] of [
      [0, 1],
      [1, 2],
      [2, 0],
    ]) {
      const from = indices.getX(offset + fromOffset);
      const to = indices.getX(offset + toOffset);
      const edge = Math.hypot(
        position.getX(from) - position.getX(to),
        position.getY(from) - position.getY(to),
        position.getZ(from) - position.getZ(to),
      );
      maximumEdge = Math.max(maximumEdge, edge);
    }
  }
  const maximumAllowedEdge = variant.nominalHeightMeters * 0.075;
  if (invalidValues) {
    failures.push(`${variant.id}: ${invalidValues} ungültige Vertexwerte`);
  }
  if (maximumEdge > maximumAllowedEdge) {
    failures.push(
      `${variant.id}: gerissenes/überlanges Dreieck ${maximumEdge.toFixed(4)} m > ${maximumAllowedEdge.toFixed(4)} m`,
    );
  }
  console.log(
    `${variant.id}: Körperkante max. ${maximumEdge.toFixed(4)} m · Grenzwert ${maximumAllowedEdge.toFixed(4)} m`,
  );
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Geometrieprüfung erfolgreich: ${manifest.variants.length} Varianten.`);
}
