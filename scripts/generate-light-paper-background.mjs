import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'assets', 'images', 'backgrounds');
const svgOutPath = path.join(outDir, 'light-abstract-paper-background.svg');
const pngOutPath = path.join(outDir, 'light-abstract-paper-background.png');

const WIDTH = 5120;
const HEIGHT = 2880;

/** Content-safe center — keep visually calm for dashboard UI. */
const CALM = { x0: 0.28 * WIDTH, x1: 0.72 * WIDTH, y0: 0.22 * HEIGHT, y1: 0.78 * HEIGHT };

function inCalmZone(x, y, margin = 0) {
  return (
    x > CALM.x0 - margin &&
    x < CALM.x1 + margin &&
    y > CALM.y0 - margin &&
    y < CALM.y1 + margin
  );
}

function circle(x, y, r, attrs = '') {
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" ${attrs}/>`;
}

function svgPath(d, attrs = '') {
  return `<path d="${d}" ${attrs}/>`;
}

function flowingBand(points, thickness) {
  const [start, c1, c2, end] = points;
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * thickness;
  const ny = (dx / len) * thickness;
  const topStart = [start[0] + nx, start[1] + ny];
  const topEnd = [end[0] + nx, end[1] + ny];
  const bottomEnd = [end[0] - nx, end[1] - ny];
  const bottomStart = [start[0] - nx, start[1] - ny];
  return [
    `M ${topStart[0].toFixed(1)} ${topStart[1].toFixed(1)}`,
    `C ${c1[0].toFixed(1)} ${(c1[1] + nx * 0.35).toFixed(1)} ${c2[0].toFixed(1)} ${(c2[1] + nx * 0.35).toFixed(1)} ${topEnd[0].toFixed(1)} ${topEnd[1].toFixed(1)}`,
    `L ${bottomEnd[0].toFixed(1)} ${bottomEnd[1].toFixed(1)}`,
    `C ${(c2[0] - nx * 0.15).toFixed(1)} ${(c2[1] - nx * 0.35).toFixed(1)} ${(c1[0] - nx * 0.15).toFixed(1)} ${(c1[1] - nx * 0.35).toFixed(1)} ${bottomStart[0].toFixed(1)} ${bottomStart[1].toFixed(1)}`,
    'Z',
  ].join(' ');
}

function accentWave(start, c1, c2, end) {
  return `M ${start.map((v) => v.toFixed(1)).join(' ')} C ${c1.map((v) => v.toFixed(1)).join(' ')} ${c2.map((v) => v.toFixed(1)).join(' ')} ${end.map((v) => v.toFixed(1)).join(' ')}`;
}

function buildSvg() {
  const bands = [
    { pts: [[-120, 2480], [980, 1880], [2480, 1180], [4680, 420]], t: 118, opacity: 0.98 },
    { pts: [[-80, 2680], [1180, 2080], [2780, 1380], [5120, 620]], t: 96, opacity: 0.95 },
    { pts: [[240, 2920], [1480, 2280], [3180, 1580], [5120, 980]], t: 74, opacity: 0.92 },
    { pts: [[520, 2760], [1720, 2140], [3520, 1440], [5120, 760]], t: 58, opacity: 0.9 },
    { pts: [[860, 2860], [1960, 2360], [3860, 1660], [5120, 1120]], t: 42, opacity: 0.88 },
  ];

  const cornerDiscs = [
    { x: -420, y: -380, r: 1180, filter: 'softShadowLg' },
    { x: -520, y: HEIGHT + 420, r: 1320, filter: 'softShadowLg' },
    { x: WIDTH + 480, y: HEIGHT + 520, r: 1420, filter: 'softShadowLg' },
    { x: WIDTH + 280, y: -220, r: 760, filter: 'softShadowMd' },
  ];

  const mediumDiscs = [
    [4300, 620, 280],
    [760, 520, 220],
    [4480, 2280, 340],
    [620, 2360, 260],
    [3820, 2480, 200],
  ];

  const buttonDots = [
    [980, 420, 34],
    [1240, 760, 22],
    [4040, 540, 28],
    [4380, 980, 18],
    [520, 1880, 26],
    [860, 2520, 20],
    [4680, 1760, 24],
    [4120, 2620, 30],
    [1560, 320, 16],
    [2860, 2480, 18],
    [3180, 380, 20],
    [980, 1280, 14],
    [4580, 1380, 16],
  ].filter(([x, y]) => !inCalmZone(x, y, 120));

  const rings = [
    [1120, 1680, 110],
    [3960, 1520, 92],
    [680, 980, 74],
    [4440, 620, 66],
  ].filter(([x, y]) => !inCalmZone(x, y, 80));

  const accentLines = [
    {
      d: accentWave([3180, 180], [3620, 420], [4040, 260], [4680, 520]),
      nodes: [[3180, 180], [4040, 260], [4680, 520]],
    },
    {
      d: accentWave([420, 2480], [920, 2140], [1280, 2360], [1680, 2060]),
      nodes: [[420, 2480], [1280, 2360], [1680, 2060]],
    },
    {
      d: accentWave([3520, 2480], [3920, 2280], [4280, 2520], [4720, 2320]),
      nodes: [[3520, 2480], [4280, 2520]],
    },
  ];

  const bandPaths = bands
    .map(
      (b, i) =>
        svgPath(flowingBand(b.pts, b.t), `fill="#FFFFFF" opacity="${b.opacity}" filter="url(#paperShadow)" data-band="${i}"`),
    )
    .join('\n    ');

  const cornerPaths = cornerDiscs
    .map(({ x, y, r, filter }) => circle(x, y, r, `fill="#FFFFFF" filter="url(#${filter})"`))
    .join('\n    ');

  const mediumPaths = mediumDiscs
    .map(([x, y, r]) => circle(x, y, r, 'fill="#FFFFFF" filter="url(#softShadowMd)"'))
    .join('\n    ');

  const ringPaths = rings
    .map(([x, y, r]) =>
      circle(x, y, r, 'fill="none" stroke="#FFFFFF" stroke-width="3.5" filter="url(#ringGlow)"'),
    )
    .join('\n    ');

  const dotPaths = buttonDots
    .map(([x, y, r]) =>
      [
        circle(x + 3, y + 5, r, 'fill="#D8D8D8" opacity="0.45"'),
        circle(x, y, r, 'fill="#FFFFFF" filter="url(#buttonLift)"'),
      ].join('\n    '),
    )
    .join('\n    ');

  const linePaths = accentLines
    .map(({ d, nodes }) => {
      const nodesMarkup = nodes
        .map(([x, y]) => circle(x, y, 10, 'fill="#FFFFFF" filter="url(#buttonLift)"'))
        .join('\n    ');
      return `${svgPath(d, 'fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" filter="url(#lineShadow)"')}\n    ${nodesMarkup}`;
    })
    .join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none">
  <defs>
    <linearGradient id="baseWash" x1="0" y1="0" x2="${WIDTH}" y2="${HEIGHT}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FAFAFA"/>
      <stop offset="42%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F7F7F7"/>
    </linearGradient>
    <radialGradient id="centerCalm" cx="50%" cy="46%" r="58%" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <filter id="paperShadow" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="14" stdDeviation="22" flood-color="#C8C8C8" flood-opacity="0.42"/>
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#E8E8E8" flood-opacity="0.55"/>
    </filter>
    <filter id="softShadowLg" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="18" stdDeviation="28" flood-color="#C8C8C8" flood-opacity="0.38"/>
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#E0E0E0" flood-opacity="0.48"/>
    </filter>
    <filter id="softShadowMd" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#CFCFCF" flood-opacity="0.4"/>
    </filter>
    <filter id="buttonLift" x="-80%" y="-80%" width="260%" height="260%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#D0D0D0" flood-opacity="0.55"/>
      <feDropShadow dx="0" dy="-2" stdDeviation="3" flood-color="#FFFFFF" flood-opacity="0.85"/>
    </filter>
    <filter id="ringGlow" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#D4D4D4" flood-opacity="0.35"/>
    </filter>
    <filter id="lineShadow" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#D8D8D8" flood-opacity="0.45"/>
    </filter>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#baseWash)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#centerCalm)"/>

  <g id="corner-discs" opacity="0.98">
    ${cornerPaths}
  </g>

  <g id="flowing-bands">
    ${bandPaths}
  </g>

  <g id="medium-discs">
    ${mediumPaths}
  </g>

  <g id="rings">
    ${ringPaths}
  </g>

  <g id="accent-lines">
    ${linePaths}
  </g>

  <g id="button-dots">
    ${dotPaths}
  </g>
</svg>`;
}

async function renderPng(svg) {
  const { Resvg } = await import('@resvg/resvg-js');
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    font: { loadSystemFonts: false },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const svg = buildSvg();
  fs.writeFileSync(svgOutPath, svg, 'utf8');
  console.log(`Wrote SVG: ${svgOutPath}`);

  const png = await renderPng(svg);
  fs.writeFileSync(pngOutPath, png);
  const sizeMb = (png.length / (1024 * 1024)).toFixed(2);
  console.log(`Wrote PNG: ${pngOutPath} (${WIDTH}x${HEIGHT}, ${sizeMb} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
