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

      const staticBg = document.querySelector('[data-testid="static-light-paper-background"]');

      return {
        layerCount: layers.length,
        staticBgPresent: Boolean(staticBg),
        transforms: layers.map((el) => ({
          cls: el.className.baseVal ?? el.className,
          attrTransform: el.getAttribute('transform'),
          cssTransform: getComputedStyle(el).transform,
        })),
      };
    });

  const t0 = await readMotion();
  if (t0.reason) {
    console.log(JSON.stringify({ ok: false, ...t0 }, null, 2));
    await browser.close();
    process.exit(1);
  }

  await page.waitForTimeout(6000);
  const t1 = await readMotion();

  let attrChanged = 0;
  let matrixChanged = 0;
  for (let i = 0; i < t0.transforms.length; i += 1) {
    const a = t0.transforms[i];
    const b = t1.transforms[i];
    if (a.attrTransform !== b.attrTransform) attrChanged += 1;
    if (a.cssTransform !== b.cssTransform) matrixChanged += 1;
  }

  const result = {
    ok: !t0.staticBgPresent && attrChanged >= 20,
    layerCount: t0.layerCount,
    staticBgPresent: t0.staticBgPresent,
    attrChanged,
    matrixChanged,
    sampleBefore: t0.transforms.slice(0, 2),
    sampleAfter: t1.transforms.slice(0, 2),
  };

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
