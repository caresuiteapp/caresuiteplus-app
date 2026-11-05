import { WIDGET_ARTWORK_PATHS, type WidgetArtworkTheme } from './widgetArtworkTheme.shared';

export const WIDGET_ARTWORK_VERSION = 'unique-2026-11';
export const WIDGET_ARTWORK_MASTER_SIZE = 2048;

function relief(path: string, stroke: string, width: number, transform = '', opacity = 1) {
  return `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${transform ? ` transform="${transform}"` : ''} opacity="${opacity}"/>`;
}

/** Shared vector construction for the body, extrusion and context object.
 * No embedded text, filters, fonts, scripts, external images or personal IDs. */
export function widgetArtworkSvg(theme: WidgetArtworkTheme): string {
  const [light, accent, dark] = theme.colors;
  const main = WIDGET_ARTWORK_PATHS[theme.primary];
  const context = WIDGET_ARTWORK_PATHS[theme.secondary];
  // Function-derived relief detail: future destinations in one theme receive
  // their own drawing. No short hash that could silently share a composition.
  const marks = Array.from(encodeURIComponent(theme.identity)).map((character, i) => {
    const value = character.codePointAt(0)!;
    const x = 76 + (i % 40) * 9;
    const y = 419 + Math.floor(i / 40) * 4;
    return `<path d="M${x} ${y}v-${(2 + value / 10).toFixed(1)}" stroke="${accent}" stroke-width="2" opacity=".28"/>`;
  }).join('');
  const variant = Array.from(theme.identity).reduce((sum, char) => sum + char.codePointAt(0)!, 0) % 3;
  const support = variant === 0
    ? `<ellipse cx="246" cy="258" rx="187" ry="151" transform="rotate(-25 246 258)" fill="none" stroke="${accent}" stroke-width="2" opacity=".18"/><ellipse cx="246" cy="258" rx="205" ry="168" transform="rotate(-25 246 258)" fill="none" stroke="${light}" stroke-width="1" opacity=".10"/>`
    : variant === 1
      ? `<path d="m64 294 181-189 190 112-180 187z" fill="url(#glass)" stroke="${light}" stroke-opacity=".14" stroke-width="2"/><path d="m64 294 191 110 180-187" fill="none" stroke="${accent}" stroke-opacity=".24" stroke-width="3"/>`
      : `<circle cx="250" cy="248" r="170" fill="url(#glass)" stroke="${accent}" stroke-opacity=".14" stroke-width="2"/><path d="M74 249a176 176 0 0 1 266-151" fill="none" stroke="${light}" stroke-width="3" opacity=".25"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDGET_ARTWORK_MASTER_SIZE}" height="${WIDGET_ARTWORK_MASTER_SIZE}" viewBox="24 24 464 464" fill="none">
<defs>
<linearGradient id="metal" x1="6" y1="2" x2="20" y2="24" gradientUnits="userSpaceOnUse"><stop stop-color="#fff"/><stop offset=".28" stop-color="${light}"/><stop offset=".53" stop-color="${accent}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
<linearGradient id="glass" x1="100" y1="80" x2="420" y2="420" gradientUnits="userSpaceOnUse"><stop stop-color="${light}" stop-opacity=".10"/><stop offset="1" stop-color="${accent}" stop-opacity=".015"/></linearGradient>
<linearGradient id="badge" x1="326" y1="308" x2="451" y2="442" gradientUnits="userSpaceOnUse"><stop stop-color="${light}"/><stop offset=".35" stop-color="${accent}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
<radialGradient id="shadow"><stop stop-color="#000e2b" stop-opacity=".55"/><stop offset="1" stop-color="#000e2b" stop-opacity="0"/></radialGradient>
</defs>
<ellipse cx="258" cy="442" rx="204" ry="34" fill="url(#shadow)"/>
${support}
<g transform="translate(78 78) rotate(-7 170 170) scale(12.5)">
${relief(main, '#020e29', 3.7, 'translate(.75 1.1)', 0.32)}
${relief(main, dark, 3.5, 'translate(.4 .62)')}
${relief(main, 'url(#metal)', 3.1)}
${relief(main, light, 0.5, 'translate(-.44 -.44)', 0.70)}
${relief(main, '#fff', 0.2, 'translate(-.71 -.71)', 0.82)}
</g>
<g>
<rect x="326" y="321" width="126" height="126" rx="36" fill="${dark}"/>
<rect x="322" y="309" width="126" height="126" rx="36" fill="url(#badge)" stroke="${light}" stroke-opacity=".65" stroke-width="2"/>
<path d="M343 319h75a20 20 0 0 1 20 20" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/>
<g transform="translate(342 329) scale(3.5)">${relief(context, dark, 1.9, 'translate(.2 .6)', 0.55)}${relief(context, '#fff', 1.75)}</g>
</g>
${marks}
</svg>`;
}
