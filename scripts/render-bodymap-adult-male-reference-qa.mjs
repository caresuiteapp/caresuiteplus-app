import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import {
  buildAdultMaleReferenceGlb,
  buildAdultMaleReferenceParts,
} from './lib/bodymap-adult-male-reference-glb.mjs';
import {
  buildAdultFemaleReferenceGlb,
  buildAdultFemaleReferenceParts,
} from './lib/bodymap-adult-female-reference-glb.mjs';

const outputRoot = process.env.BODYMAP3D_QA_OUTPUT_ROOT
  ? resolve(process.env.BODYMAP3D_QA_OUTPUT_ROOT)
  : process.cwd();
const referenceVariant =
  process.env.BODYMAP3D_REFERENCE_VARIANT ?? 'body-erwachsener-maennlich';
const referenceConfigurations = {
  'body-erwachsener-maennlich': {
    artifactName: 'adult-male-four-view',
    artifactDirectoryName: 'bodymap-adult-male-reference-qa',
    phase: 5,
    title: 'Erwachsener · Männlich · Technischer Referenzkörper v2',
    buildParts: buildAdultMaleReferenceParts,
    buildGlb: buildAdultMaleReferenceGlb,
  },
  'body-erwachsener-weiblich': {
    artifactName: 'adult-female-four-view',
    artifactDirectoryName: 'bodymap-adult-female-reference-qa',
    phase: 6,
    title: 'Erwachsen · Weiblich · Technischer Referenzkörper v2',
    buildParts: buildAdultFemaleReferenceParts,
    buildGlb: buildAdultFemaleReferenceGlb,
  },
};
const referenceConfiguration = referenceConfigurations[referenceVariant];
if (!referenceConfiguration) {
  throw new Error(`Unbekannte Referenzvariante: ${referenceVariant}`);
}
const artifactDirectory = resolve(
  outputRoot,
  `artifacts/${referenceConfiguration.artifactDirectoryName}`,
);
const qaDirectory = resolve(outputRoot, 'docs/bodymap3d/qa');
const svgPath = resolve(artifactDirectory, `${referenceConfiguration.artifactName}.svg`);
const pngPath = resolve(qaDirectory, `${referenceConfiguration.artifactName}.png`);
const manifestPath = resolve(qaDirectory, `${referenceConfiguration.artifactName}.json`);
const parts = referenceConfiguration.buildParts();
const generated = referenceConfiguration.buildGlb();

const views = [
  { id: 'front', label: 'VORDERSEITE', yaw: 0 },
  { id: 'back', label: 'RÜCKSEITE', yaw: Math.PI },
  { id: 'left', label: 'LINKE SEITE', yaw: -Math.PI / 2 },
  { id: 'right', label: 'RECHTE SEITE', yaw: Math.PI / 2 },
];
const materialColors = [
  [185, 120, 85],
  [143, 48, 56],
  [232, 232, 219],
  [31, 71, 82],
  [4, 3, 3],
  [201, 140, 120],
];

function rotateY([x, y, z], yaw) {
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  return [x * cosine + z * sine, y, -x * sine + z * cosine];
}

function escaped(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function shadedColor(base, intensity) {
  const resolved = base.map((value) =>
    Math.max(0, Math.min(255, Math.round(value * intensity))),
  );
  return `rgb(${resolved.join(',')})`;
}

function renderView(view, originX) {
  const scale = 395;
  const centerX = originX + 190;
  const floorY = 865;
  const polygons = [];
  for (const part of parts) {
    const positions = part.geometry.positions;
    const normals = part.geometry.normals;
    const indices = part.geometry.indices;
    const baseColor = materialColors[part.material ?? 0] ?? materialColors[0];
    for (let index = 0; index < indices.length; index += 3) {
      const vertexIndices = [indices[index], indices[index + 1], indices[index + 2]];
      const points = vertexIndices.map((vertexIndex) =>
        rotateY(
          [
            positions[vertexIndex * 3],
            positions[vertexIndex * 3 + 1],
            positions[vertexIndex * 3 + 2],
          ],
          view.yaw,
        ),
      );
      const averageNormal = rotateY(
        vertexIndices
          .map((vertexIndex) => [
            normals[vertexIndex * 3],
            normals[vertexIndex * 3 + 1],
            normals[vertexIndex * 3 + 2],
          ])
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
        0.64 +
        Math.max(0, averageNormal[2]) * 0.27 +
        Math.max(0, -averageNormal[0]) * 0.08 +
        Math.max(0, averageNormal[1]) * 0.06;
      polygons.push({
        depth,
        color: shadedColor(baseColor, Math.min(1.14, light)),
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
            `<polygon points="${polygon.points}" fill="${polygon.color}" stroke="${polygon.color}" stroke-width="0.42" stroke-linejoin="round" />`,
        )
        .join('')}</g>
      <line x1="${originX + 45}" y1="${floorY + 1}" x2="${originX + 335}" y2="${floorY + 1}"
        stroke="#365478" stroke-width="1" />
    </g>`;
}

const viewMarkup = views
  .map((view, index) => renderView(view, 28 + index * 398))
  .join('');
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1648" height="1080" viewBox="0 0 1648 1080">
  <rect width="1648" height="1080" fill="#04101f" />
  <text x="32" y="42" fill="#66a3ff" font-family="Arial, sans-serif"
    font-size="13" font-weight="800" letter-spacing="2">CARESUITE · BODYMAP PHASE ${referenceConfiguration.phase}</text>
  <text x="32" y="72" fill="#f5f9ff" font-family="Arial, sans-serif"
    font-size="24" font-weight="900">${referenceConfiguration.title}</text>
  ${viewMarkup}
  <rect x="28" y="925" width="1574" height="120" rx="18"
    fill="#08172b" stroke="rgba(112,165,255,0.28)" />
  <text x="52" y="958" fill="#f6ae2d" font-family="Arial, sans-serif"
    font-size="15" font-weight="900">NICHT MEDIZINISCH FREIGEGEBEN · PRODUKTIVER FALLBACK BLEIBT AKTIV</text>
  <text x="52" y="988" fill="#a9b9d2" font-family="Arial, sans-serif"
    font-size="13">${escaped(`${generated.summary.zones.length} Zonen · ${generated.summary.vertices} Vertices · ${generated.summary.triangles} Dreiecke · vollständige GLB- und UV-Prüfung bestanden`)}</text>
  <text x="52" y="1016" fill="#8297b6" font-family="Arial, sans-serif"
    font-size="12">Softwareprojektion direkt aus den eingecheckten GLB-Dreiecken; fachmedizinische Anatomieprüfung und sensible Freigabe stehen aus.</text>
</svg>`;

await mkdir(artifactDirectory, { recursive: true });
await mkdir(qaDirectory, { recursive: true });
await writeFile(svgPath, svg, 'utf8');
const rendered = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1648 },
  background: '#04101f',
});
await writeFile(pngPath, rendered.render().asPng());
await writeFile(
  manifestPath,
  `${JSON.stringify(
    {
      projectionVersion: 1,
      source: 'CareSuite deterministic GLB triangle projection',
      variantId: generated.summary.variantId,
      views: views.map((view) => view.id),
      ...generated.summary,
      svgPath: `artifacts/${referenceConfiguration.artifactDirectoryName}/${referenceConfiguration.artifactName}.svg`,
      pngPath: `docs/bodymap3d/qa/${referenceConfiguration.artifactName}.png`,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`Software-Vieransichten-QA: ${pngPath}`);
console.log(`Ansichten: ${views.length}/4`);
console.log(`Zonen: ${generated.summary.zones.length}`);
console.log('Medizinische Freigabe: NEIN');
