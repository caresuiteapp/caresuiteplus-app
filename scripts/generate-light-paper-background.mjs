import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'assets', 'images', 'backgrounds');
const svgOutPath = path.join(outDir, 'light-abstract-paper-background.svg');
const pngOutPath = path.join(outDir, 'light-abstract-paper-background.png');
const animatedTokenPath = path.join(root, 'src', 'design', 'tokens', 'lightPaperBackgroundAnimated.ts');

const LPB_CYCLE_S = 120;

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

/** Extend a segment beyond its endpoints so cover-crop never clips a hard cap. */
function extendSegment(start, end, pad = 420) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return [
    [start[0] - ux * pad, start[1] - uy * pad],
    [end[0] + ux * pad, end[1] + uy * pad],
  ];
}

/** Linear gradient + mask that fades band ends before the viewport edge. */
function bandFadeDefs(id, start, end, fadeLength = 520) {
  const [[sx, sy], [ex, ey]] = extendSegment(start, end, fadeLength * 1.6);
  const totalLen = Math.hypot(ex - sx, ey - sy) || 1;
  const fadePct = Math.min(22, (fadeLength / totalLen) * 100);
  return `
    <linearGradient id="bandFade${id}" x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="white" stop-opacity="0"/>
      <stop offset="${fadePct.toFixed(1)}%" stop-color="white" stop-opacity="1"/>
      <stop offset="${(100 - fadePct).toFixed(1)}%" stop-color="white" stop-opacity="1"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
    <mask id="bandMask${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${WIDTH}" height="${HEIGHT}">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bandFade${id})"/>
    </mask>`;
}

/** Stroke gradient that fades accent lines at both ends. */
function lineFadeDef(id, start, end, fadeLength = 360) {
  const [[x1, y1], [x2, y2]] = extendSegment(start, end, fadeLength);
  const totalLen = Math.hypot(x2 - x1, y2 - y1) || 1;
  const fadePct = Math.min(28, (fadeLength / totalLen) * 100);
  return `
    <linearGradient id="lineFade${id}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="${fadePct.toFixed(1)}%" stop-color="#FFFFFF" stop-opacity="1"/>
      <stop offset="${(100 - fadePct).toFixed(1)}%" stop-color="#FFFFFF" stop-opacity="1"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>`;
}

function hashSeed(key) {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function unitVector(from, to) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

function layerMotion(kind, index, direction = null) {
  const rand = seededRandom(hashSeed(`lpb-${kind}-${index}`));
  /** SVG `<g>` ignores CSS transform keyframes in Chromium — amplitudes tuned for rAF attribute motion. */
  const ampScale =
    kind === 'corner' ? [110, 260] :
    kind === 'medium' ? [78, 195] :
    kind === 'band' ? [62, 155] :
    kind === 'line' ? [48, 125] :
    kind === 'ring' ? [32, 78] :
    [36, 95];
  const amp = ampScale[0] + rand() * (ampScale[1] - ampScale[0]);
  let dx;
  let dy;
  if (direction) {
    const jitter = (rand() - 0.5) * amp * 0.22;
    dx = direction[0] * amp + (-direction[1] * jitter);
    dy = direction[1] * amp + (direction[0] * jitter);
  } else {
    const angle = rand() * Math.PI * 2;
    dx = Math.cos(angle) * amp;
    dy = Math.sin(angle) * amp;
  }
  const scalePeak = kind === 'band' ? 1 + rand() * 0.012 : 1 + rand() * 0.008;
  return {
    id: `${kind}-${index}`,
    className: `lpb-${kind}-${index}`,
    dx: Number(dx.toFixed(2)),
    dy: Number(dy.toFixed(2)),
    scalePeak: Number(scalePeak.toFixed(4)),
    delayS: Number((rand() * LPB_CYCLE_S).toFixed(2)),
  };
}

function layerClass(kind, index) {
  return `class="lpb-layer lpb-${kind}-${index}"`;
}

function buildAnimationCss() {
  return `.lpb-root svg {
  width: 100%;
  height: 100%;
  display: block;
}
.lpb-layer {
  will-change: transform;
}`;
}

function writeAnimatedToken(svgInner, layers) {
  const css = buildAnimationCss();
  const content = `/** Generated by scripts/generate-light-paper-background.mjs — do not edit manually. */

export const LPB_CYCLE_S = ${LPB_CYCLE_S} as const;

export const LPB_ANIMATED_ELEMENT_COUNT = ${layers.length} as const;

export type LightPaperAnimLayer = {
  id: string;
  className: string;
  dx: number;
  dy: number;
  scalePeak: number;
  delayS: number;
};

export const lightPaperAnimLayers: LightPaperAnimLayer[] = ${JSON.stringify(layers, null, 2)};

export const lightPaperBackgroundAnimationCss = ${JSON.stringify(css)};

export const lightPaperBackgroundAnimatedSvg = ${JSON.stringify(svgInner)};
`;
  fs.mkdirSync(path.dirname(animatedTokenPath), { recursive: true });
  fs.writeFileSync(animatedTokenPath, content, 'utf8');
}

function extendBandPoints(pts, pad = 480) {
  const [start, c1, c2, end] = pts;
  const [[nsx, nsy], [nex, ney]] = extendSegment(start, end, pad);
  const t = pad / (Math.hypot(end[0] - start[0], end[1] - start[1]) || 1);
  const nc1 = [c1[0] - (end[0] - start[0]) * t * 0.15, c1[1] - (end[1] - start[1]) * t * 0.15];
  const nc2 = [c2[0] + (end[0] - start[0]) * t * 0.15, c2[1] + (end[1] - start[1]) * t * 0.15];
  return [[nsx, nsy], nc1, nc2, [nex, ney]];
}

function buildSvg() {
  const bands = [
    { pts: [[-120, 2480], [980, 1880], [2480, 1180], [4680, 420]], t: 118, opacity: 0.98 },
    { pts: [[-80, 2680], [1180, 2080], [2780, 1380], [5120, 620]], t: 96, opacity: 0.95 },
    { pts: [[240, 2920], [1480, 2280], [3180, 1580], [5120, 980]], t: 74, opacity: 0.92 },
    { pts: [[520, 2760], [1720, 2140], [3520, 1440], [5120, 760]], t: 58, opacity: 0.9 },
    { pts: [[860, 2860], [1960, 2360], [3860, 1660], [5120, 1120]], t: 42, opacity: 0.88 },
  ].map((b) => ({ ...b, pts: extendBandPoints(b.pts, 560) }));

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
      start: [3180, 180],
      c1: [3620, 420],
      c2: [4040, 260],
      end: [4680, 520],
      nodes: [[3180, 180], [4040, 260], [4680, 520]],
    },
    {
      start: [420, 2480],
      c1: [920, 2140],
      c2: [1280, 2360],
      end: [1680, 2060],
      nodes: [[420, 2480], [1280, 2360], [1680, 2060]],
    },
    {
      start: [3520, 2480],
      c1: [3920, 2280],
      c2: [4280, 2520],
      end: [4720, 2320],
      nodes: [[3520, 2480], [4280, 2520]],
    },
  ].map((line) => {
    const [[sx, sy], [ex, ey]] = extendSegment(line.start, line.end, 380);
    return {
      ...line,
      start: [sx, sy],
      end: [ex, ey],
      d: accentWave([sx, sy], line.c1, line.c2, [ex, ey]),
    };
  });

  const animLayers = [];

  cornerDiscs.forEach((_, i) => animLayers.push(layerMotion('corner', i)));
  bands.forEach((b, i) => animLayers.push(layerMotion('band', i, unitVector(b.pts[0], b.pts[3]))));
  mediumDiscs.forEach((_, i) => animLayers.push(layerMotion('medium', i)));
  rings.forEach((_, i) => animLayers.push(layerMotion('ring', i)));
  accentLines.forEach((line, i) =>
    animLayers.push(layerMotion('line', i, unitVector(line.start, line.end))),
  );
  buttonDots.forEach((_, i) => animLayers.push(layerMotion('dot', i)));

  const bandPaths = bands
    .map(
      (b, i) =>
        `<g ${layerClass('band', i)} mask="url(#bandMask${i})">\n      ${svgPath(flowingBand(b.pts, b.t), `fill="#FFFFFF" opacity="${b.opacity}" filter="url(#paperShadow)" data-band="${i}"`)}\n    </g>`,
    )
    .join('\n    ');

  const bandFadeDefsMarkup = bands
    .map((b, i) => bandFadeDefs(i, b.pts[0], b.pts[3]))
    .join('\n    ');

  const lineFadeDefsMarkup = accentLines
    .map((line, i) => lineFadeDef(i, line.start, line.end))
    .join('\n    ');

  const cornerPaths = cornerDiscs
    .map(({ x, y, r, filter }, i) =>
      `<g ${layerClass('corner', i)}>${circle(x, y, r, `fill="#FFFFFF" filter="url(#${filter})"`)}</g>`,
    )
    .join('\n    ');

  const mediumPaths = mediumDiscs
    .map(([x, y, r], i) =>
      `<g ${layerClass('medium', i)}>${circle(x, y, r, 'fill="#FFFFFF" filter="url(#softShadowMd)"')}</g>`,
    )
    .join('\n    ');

  const ringPaths = rings
    .map(([x, y, r], i) =>
      `<g ${layerClass('ring', i)}>${circle(x, y, r, 'fill="none" stroke="#FFFFFF" stroke-width="3.5" filter="url(#ringGlow)"')}</g>`,
    )
    .join('\n    ');

  const dotPaths = buttonDots
    .map(([x, y, r], i) => {
      const dotR = r * 1.08;
      return `<g ${layerClass('dot', i)}>
    ${circle(x + 4, y + 6, dotR + 1, 'fill="#A8A8A8" opacity="0.38"')}
    ${circle(x, y, dotR + 2.2, 'fill="none" stroke="#9A9A9A" stroke-width="1.4" opacity="0.72"')}
    ${circle(x, y, dotR, 'fill="#F6F6F6" filter="url(#buttonLiftStrong)"')}
    </g>`;
    })
    .join('\n    ');

  const linePaths = accentLines
    .map(({ d, nodes }, i) => {
      const nodesMarkup = nodes
        .map(([x, y]) => circle(x, y, 10, 'fill="#FFFFFF" filter="url(#buttonLift)"'))
        .join('\n    ');
      return `<g ${layerClass('line', i)}>
    ${svgPath(d, `fill="none" stroke="url(#lineFade${i})" stroke-width="2.5" stroke-linecap="round" filter="url(#lineShadow)"`)}
    ${nodesMarkup}
    </g>`;
    })
    .join('\n    ');

  return {
    svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" preserveAspectRatio="xMidYMid slice">
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
    <filter id="buttonLiftStrong" x="-100%" y="-100%" width="300%" height="300%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="7" stdDeviation="9" flood-color="#A8A8A8" flood-opacity="0.62"/>
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#C4C4C4" flood-opacity="0.48"/>
      <feDropShadow dx="0" dy="-2" stdDeviation="3" flood-color="#FFFFFF" flood-opacity="0.9"/>
    </filter>
    ${bandFadeDefsMarkup}
    ${lineFadeDefsMarkup}
    <filter id="ringGlow" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#D4D4D4" flood-opacity="0.35"/>
    </filter>
    <filter id="lineShadow" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#D8D8D8" flood-opacity="0.45"/>
    </filter>
  </defs>

  <rect class="lpb-base-wash" width="${WIDTH}" height="${HEIGHT}" fill="url(#baseWash)"/>
  <rect class="lpb-base-wash" width="${WIDTH}" height="${HEIGHT}" fill="url(#centerCalm)"/>

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
</svg>`,
    animLayers,
  };
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
  const { svg, animLayers } = buildSvg();
  fs.writeFileSync(svgOutPath, svg, 'utf8');
  console.log(`Wrote SVG: ${svgOutPath}`);

  writeAnimatedToken(svg, animLayers);
  console.log(
    `Wrote animated token: ${animatedTokenPath} (${animLayers.length} layers, ${LPB_CYCLE_S}s cycle)`,
  );

  const png = await renderPng(svg);
  fs.writeFileSync(pngOutPath, png);
  const sizeMb = (png.length / (1024 * 1024)).toFixed(2);
  console.log(`Wrote PNG: ${pngOutPath} (${WIDTH}x${HEIGHT}, ${sizeMb} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
