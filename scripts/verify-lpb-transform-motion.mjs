/**
 * Deep verify: confirm SVG layer transforms actually change over time.
 */
const url = process.argv[2] ?? 'http://localhost:8082';

async function main() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(2000);

  const snapshot = () =>
    page.evaluate(() => {
      const host =
        document.querySelector('[data-testid="animated-light-paper-background"]') ??
        document.querySelector('.lpb-root');
      if (!host) return { error: 'no host' };

      const layers = [...host.querySelectorAll('.lpb-layer')];
      const staticBg = document.querySelector('[data-testid="static-light-paper-background"]');

      const readLayer = (el) => {
        const cs = getComputedStyle(el);
        const cls = el.className.baseVal ?? el.className;
        let ctm = null;
        try {
          ctm = el.getCTM?.()?.toString?.() ?? null;
        } catch {
          ctm = null;
        }
        return {
          cls,
          transform: cs.transform,
          animationName: cs.animationName,
          ctm,
        };
      };

      return {
        hostTag: host.tagName,
        hostClass: host.className,
        layerCount: layers.length,
        staticBgPresent: Boolean(staticBg),
        innerHtmlLen: host.innerHTML.length,
        layers: layers.map(readLayer),
      };
    });

  const t0 = await snapshot();
  await page.waitForTimeout(8000);
  const t1 = await snapshot();

  if (t0.error || t1.error) {
    console.log(JSON.stringify({ ok: false, t0, t1 }, null, 2));
    await browser.close();
    process.exit(1);
  }

  let transformChanged = 0;
  let ctmChanged = 0;
  const details = [];

  for (let i = 0; i < t0.layers.length; i += 1) {
    const a = t0.layers[i];
    const b = t1.layers[i];
    const tfChanged = a.transform !== b.transform;
    const ctmDiff = a.ctm !== b.ctm;
    if (tfChanged) transformChanged += 1;
    if (ctmDiff) ctmChanged += 1;
    if (tfChanged || ctmDiff) {
      details.push({
        cls: a.cls,
        t0Transform: a.transform,
        t1Transform: b.transform,
        t0Ctm: a.ctm,
        t1Ctm: b.ctm,
      });
    }
  }

  const result = {
    ok: transformChanged > 0 || ctmChanged > 0,
    layerCount: t0.layerCount,
    staticBgPresent: t0.staticBgPresent,
    innerHtmlLen: t0.innerHtmlLen,
    transformChanged,
    ctmChanged,
    details: details.slice(0, 6),
  };

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
