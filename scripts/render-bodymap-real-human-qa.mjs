import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ({
  width: 128,
  height: 128,
  close() {},
});

const variantId =
  process.env.BODYMAP3D_REFERENCE_VARIANT ?? 'body-erwachsener-maennlich';
const manifest = JSON.parse(
  await readFile('assets/bodymap3d/v3/real-human-manifest.json', 'utf8'),
);
const definition = manifest.variants.find((entry) => entry.id === variantId);
if (!definition) throw new Error(`Unbekannte Real-Human-Variante: ${variantId}`);
const glbPath = resolve(`public${definition.visualAssetPath}`);
const glb = await readFile(glbPath);
const arrayBuffer = glb.buffer.slice(
  glb.byteOffset,
  glb.byteOffset + glb.byteLength,
);
const loaded = await new Promise((resolveLoaded, rejectLoaded) => {
  new GLTFLoader().parse(arrayBuffer, '', resolveLoaded, rejectLoaded);
});

const renderMeshes = [];
loaded.scene.updateMatrixWorld(true);
loaded.scene.traverse((object) => {
  if (!object.isMesh) return;
  const position = object.geometry.getAttribute('position');
  const normal = object.geometry.getAttribute('normal');
  const index = object.geometry.index;
  if (!position || !normal || !index) return;
  renderMeshes.push({
    name: object.name,
    position,
    normal,
    index,
    matrixWorld: object.matrixWorld.clone(),
    color: object.name.includes('eye')
      ? [232, 232, 219]
      : object.name.includes('iris')
        ? [53, 87, 102]
        : object.name.includes('pupil')
          ? [4, 5, 6]
      : object.name.includes('teeth')
        ? [232, 224, 205]
        : [185, 120, 85],
  });
});

const views = [
  { id: 'front', label: 'VORDERSEITE', yaw: 0 },
  { id: 'back', label: 'RÜCKSEITE', yaw: Math.PI },
  { id: 'left', label: 'LINKE SEITE', yaw: -Math.PI / 2 },
  { id: 'right', label: 'RECHTE SEITE', yaw: Math.PI / 2 },
];

function rotateY(vector, yaw) {
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  return [
    vector[0] * cosine + vector[2] * sine,
    vector[1],
    -vector[0] * sine + vector[2] * cosine,
  ];
}

function transform(attribute, index, matrix, direction = false) {
  const x = attribute.getX(index);
  const y = attribute.getY(index);
  const z = attribute.getZ(index);
  const elements = matrix.elements;
  if (direction) {
    return [
      elements[0] * x + elements[4] * y + elements[8] * z,
      elements[1] * x + elements[5] * y + elements[9] * z,
      elements[2] * x + elements[6] * y + elements[10] * z,
    ];
  }
  return [
    elements[0] * x + elements[4] * y + elements[8] * z + elements[12],
    elements[1] * x + elements[5] * y + elements[9] * z + elements[13],
    elements[2] * x + elements[6] * y + elements[10] * z + elements[14],
  ];
}

function shade(base, intensity) {
  const resolved = base.map((value) =>
    Math.max(0, Math.min(255, Math.round(value * intensity))),
  );
  return `rgb(${resolved.join(',')})`;
}

function renderView(view, originX) {
  const scale = 680 / definition.nominalHeightMeters;
  const centerX = originX + 190;
  const floorY = 865;
  const polygons = [];
  for (const mesh of renderMeshes) {
    for (let offset = 0; offset < mesh.index.count; offset += 3) {
      const vertexIndices = [
        mesh.index.getX(offset),
        mesh.index.getX(offset + 1),
        mesh.index.getX(offset + 2),
      ];
      const points = vertexIndices.map((index) =>
        rotateY(transform(mesh.position, index, mesh.matrixWorld), view.yaw),
      );
      const averageNormal = rotateY(
        vertexIndices
          .map((index) => transform(mesh.normal, index, mesh.matrixWorld, true))
          .reduce(
            (sum, normal) => [
              sum[0] + normal[0] / 3,
              sum[1] + normal[1] / 3,
              sum[2] + normal[2] / 3,
            ],
            [0, 0, 0],
          ),
        view.yaw,
      );
      if (averageNormal[2] < -0.08) continue;
      const depth = points.reduce((sum, point) => sum + point[2] / 3, 0);
      const light =
        0.62 +
        Math.max(0, averageNormal[2]) * 0.3 +
        Math.max(0, -averageNormal[0]) * 0.09 +
        Math.max(0, averageNormal[1]) * 0.05;
      polygons.push({
        depth,
        color: shade(mesh.color, Math.min(1.15, light)),
        points: points
          .map(
            (point) =>
              `${(centerX + point[0] * scale).toFixed(1)},${(
                floorY -
                point[1] * scale
              ).toFixed(1)}`,
          )
          .join(' '),
      });
    }
  }
  polygons.sort((a, b) => a.depth - b.depth);
  return `
    <g>
      <rect x="${originX}" y="92" width="380" height="805" rx="22"
        fill="#071326" stroke="rgba(112,165,255,0.34)" />
      <text x="${originX + 24}" y="130" fill="#dce9fb"
        font-family="Arial, sans-serif" font-size="15" font-weight="800">${view.label}</text>
      <line x1="${originX + 24}" y1="145" x2="${originX + 356}" y2="145"
        stroke="rgba(112,165,255,0.24)" />
      <g>${polygons
        .map(
          (polygon) =>
            `<polygon points="${polygon.points}" fill="${polygon.color}" />`,
        )
        .join('')}</g>
      <line x1="${originX + 45}" y1="${floorY + 1}" x2="${originX + 335}" y2="${floorY + 1}"
        stroke="#365478" stroke-width="1" />
    </g>`;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1648" height="1080" viewBox="0 0 1648 1080">
  <rect width="1648" height="1080" fill="#04101f" />
  <text x="32" y="42" fill="#66a3ff" font-family="Arial, sans-serif"
    font-size="13" font-weight="800" letter-spacing="2">CARESUITE · BODYMAP VISUAL QA</text>
  <text x="32" y="72" fill="#f5f9ff" font-family="Arial, sans-serif"
    font-size="24" font-weight="900">${variantId} · REAL-HUMAN PRODUKTIONSKANDIDAT</text>
  ${views.map((view, index) => renderView(view, 28 + index * 398)).join('')}
  <rect x="28" y="925" width="1574" height="120" rx="18"
    fill="#08172b" stroke="rgba(112,165,255,0.28)" />
  <text x="52" y="958" fill="#f6ae2d" font-family="Arial, sans-serif"
    font-size="15" font-weight="900">ECHTE HUMAN-TOPOLOGIE · MEDIZINISCHE FREIGABE NOCH AUSSTEHEND</text>
  <text x="52" y="988" fill="#a9b9d2" font-family="Arial, sans-serif"
    font-size="13">${definition.vertices} Vertices · ${definition.triangles} Dreiecke · ${Math.round(definition.fileSizeBytes / 1024)} KB · CC0-Quelltopologie</text>
  <text x="52" y="1016" fill="#8297b6" font-family="Arial, sans-serif"
    font-size="12">Deterministische Softwareprojektion direkt aus dem Phase-11-GLB; Interaktionszonen und klinische Daten bleiben aus Phase 10 erhalten.</text>
</svg>`;

const outputDirectory = resolve('artifacts/bodymap-phase11-real-human-qa');
await mkdir(outputDirectory, { recursive: true });
const svgPath = resolve(outputDirectory, `${variantId}-four-view.svg`);
const pngPath = resolve(outputDirectory, `${variantId}-four-view.png`);
await writeFile(svgPath, svg, 'utf8');
await writeFile(
  pngPath,
  new Resvg(svg, {
    fitTo: { mode: 'width', value: 1648 },
    background: '#04101f',
  })
    .render()
    .asPng(),
);
console.log(`Real-Human-QA: ${pngPath}`);
