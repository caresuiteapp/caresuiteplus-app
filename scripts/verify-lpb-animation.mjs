/**
 * Verify light paper background motion on localhost:8082.
 * Usage: node scripts/verify-lpb-animation.mjs [url]
 */
const url = process.argv[2] ?? 'http://localhost:8082';

async function main() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    console.error('playwright not installed — run: npx playwright install chromium');
    process.exit(2);
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(2000);

  const readMotion = () =>
    page.evaluate(() => {
      const host =
        document.querySelector('[data-testid="animated-light-paper-background"]') ??
        document.querySelector('.lpb-root');
      if (!host) {
        return { ok: false, reason: 'no lpb host found' };
      }

      const layers = [...host.querySelectorAll('.lpb-layer')];
      if (layers.length === 0) {
        return { ok: false, reason: 'no .lpb-layer elements in host' };
      }

      const smilNodes = [...host.querySelectorAll('animateTransform')];
      const staticBg = document.querySelector('[data-testid="static-light-paper-background"]');

      const layerSamples = layers.slice(0, 5).map((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const ctm = typeof el.getCTM === 'function' ? el.getCTM() : null;
        return {
          cls: el.className.baseVal ?? el.className,
          opacity: Number(style.opacity),
          visible: rect.width > 0 && rect.height > 0,
          x: rect.x,
          y: rect.y,
          ctmE: ctm?.e ?? null,
          ctmF: ctm?.f ?? null,
        };
      });

      const svg = host.querySelector('svg');
      const svgTime = svg?.getCurrentTime?.() ?? null;

      return {
        layerCount: layers.length,
        smilCount: smilNodes.length,
        staticBgPresent: Boolean(staticBg),
        svgTime,
        layerSamples,
        positions: layers.map((el) => {
          const rect = el.getBoundingClientRect();
          const ctm = typeof el.getCTM === 'function' ? el.getCTM() : null;
          return {
            cls: el.className.baseVal ?? el.className,
            x: rect.x,
            y: rect.y,
            ctmE: ctm?.e ?? null,
            ctmF: ctm?.f ?? null,
          };
        }),
      };
    });

  const t0 = await readMotion();
  if (t0.reason) {
    console.log(JSON.stringify({ ok: false, ...t0 }, null, 2));
    await browser.close();
    process.exit(1);
  }

  await page.waitForTimeout(5000);
  const t5 = await readMotion();

  await page.waitForTimeout(25000);
  const t30 = await readMotion();

  let positionChanged = 0;
  for (let i = 0; i < t0.positions.length; i += 1) {
    const a = t0.positions[i];
    const b = t30.positions[i];
    const delta = Math.hypot((b.x ?? 0) - (a.x ?? 0), (b.y ?? 0) - (a.y ?? 0));
    const ctmDelta = Math.hypot((b.ctmE ?? 0) - (a.ctmE ?? 0), (b.ctmF ?? 0) - (a.ctmF ?? 0));
    if (delta > 0.5 || ctmDelta > 0.5) positionChanged += 1;
  }

  const allVisible =
    t0.layerCount === t5.layerCount &&
    t5.layerCount === t30.layerCount &&
    t0.layerCount >= 34 &&
    t0.layerSamples.every((s) => s.opacity > 0 && s.visible);

  const svgRunning =
    t30.svgTime != null && t0.svgTime != null && t30.svgTime - t0.svgTime > 20;

  const result = {
    ok:
      !t0.staticBgPresent &&
      allVisible &&
      t0.smilCount >= 34 &&
      (positionChanged >= 20 || svgRunning),
    layerCount: { t0: t0.layerCount, t5: t5.layerCount, t30: t30.layerCount },
    smilCount: t0.smilCount,
    staticBgPresent: t0.staticBgPresent,
    positionChanged,
    svgTimeDelta: t30.svgTime != null && t0.svgTime != null ? t30.svgTime - t0.svgTime : null,
    sampleLayers: t0.layerSamples,
    samplePositionBefore: t0.positions.slice(0, 2),
    samplePositionAfter: t30.positions.slice(0, 2),
  };

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
