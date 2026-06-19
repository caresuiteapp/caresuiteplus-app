#!/usr/bin/env node
/**
 * Runtime background audit via CDP (Playwright + system Edge).
 *
 * Usage:
 *   node scripts/audit-runtime-backgrounds.mjs
 *   node scripts/audit-runtime-backgrounds.mjs --route /business/office/clients --json
 */

import { chromium } from 'playwright';

const AUDIT_FN = `(() => {
  const MIN_BRIGHTNESS = 205;
  const MIN_AREA = 5000;
  const MIN_ALPHA = 0.4;
  const TOP_N = 20;

  function parseBackgroundColor(color) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;
    const rgb = color.match(/^rgb\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*\\)$/i);
    if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: 1 };
    const rgba = color.match(/^rgba\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*([\\d.]+)\\s*\\)$/i);
    if (rgba) return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: +rgba[4] };
    return null;
  }

  function luminance(r, g, b) {
    return (r * 299 + g * 587 + b * 114) / 1000;
  }

  const offenders = [];
  for (const el of document.querySelectorAll('*')) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const area = rect.width * rect.height;
    if (area < MIN_AREA) continue;
    const bg = window.getComputedStyle(el).backgroundColor;
    const parsed = parseBackgroundColor(bg);
    if (!parsed || parsed.a < MIN_ALPHA) continue;
    const brightness = luminance(parsed.r, parsed.g, parsed.b);
    if (brightness <= MIN_BRIGHTNESS) continue;
    offenders.push({
      tag: el.tagName.toLowerCase(),
      className: typeof el.className === 'string' ? el.className : '',
      testId: el.getAttribute('data-testid'),
      id: el.getAttribute('id'),
      backgroundColor: bg,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      area: Math.round(area),
      brightness: Math.round(brightness * 10) / 10,
      alpha: parsed.a,
    });
  }

  offenders.sort((a, b) => b.area - a.area);
  return {
    route: location.pathname,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    offenderCount: offenders.length,
    top: offenders.slice(0, TOP_N),
  };
})()`;

function parseArgs(argv) {
  const args = {
    base: process.env.AUDIT_BASE_URL ?? 'http://localhost:8081',
    route: '/business/office/clients',
    width: 1440,
    height: 900,
    waitMs: 5000,
    json: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--route') args.route = argv[++i];
    else if (arg === '--base') args.base = argv[++i];
    else if (arg === '--width') args.width = Number(argv[++i]);
    else if (arg === '--height') args.height = Number(argv[++i]);
    else if (arg === '--wait') args.waitMs = Number(argv[++i]);
    else if (arg === '--json') args.json = true;
  }

  return args;
}

function formatTable(top) {
  if (!top.length) return '  (none)';
  return top
    .map((o, i) => {
      const label = o.testId ?? o.id ?? `${o.tag}.${o.className.split(' ')[0] || 'no-class'}`;
      return `  ${String(i + 1).padStart(2)}. ${label} | ${o.backgroundColor} | ${o.rect.width}x${o.rect.height} (${o.area}px²) | bright=${o.brightness}`;
    })
    .join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const url = `${args.base.replace(/\/$/, '')}${args.route}`;

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: args.width, height: args.height } });

  let navError = null;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(args.waitMs);
  } catch (error) {
    navError = error instanceof Error ? error.message : String(error);
  }

  const result = navError
    ? {
        error: navError,
        route: args.route,
        viewport: { width: args.width, height: args.height },
        offenderCount: -1,
        top: [],
      }
    : await page.evaluate(AUDIT_FN);

  await browser.close();

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(navError ? 2 : 0);
    return;
  }

  console.log('=== audit:runtime-backgrounds ===');
  console.log(`URL: ${url}`);
  if (result.error) {
    console.error(`Navigation error: ${result.error}`);
    process.exit(2);
  }
  console.log(`Route: ${result.route}`);
  console.log(`Viewport: ${result.viewport.width}x${result.viewport.height}`);
  console.log(`Offenders (brightness>205, area>5000, alpha>0.4): ${result.offenderCount}`);
  console.log('Top offenders:');
  console.log(formatTable(result.top));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
