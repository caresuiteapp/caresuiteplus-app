/**
 * Verify light paper background CSS animations on localhost:8082.
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

  const result = await page.evaluate(() => {
    const host =
      document.querySelector('[data-testid="animated-light-paper-background"]') ??
      document.querySelector('.lpb-root');
    if (!host) {
      return { ok: false, reason: 'no lpb host found' };
    }

    const layers = host.querySelectorAll('.lpb-layer');
    if (layers.length === 0) {
      return { ok: false, reason: 'no .lpb-layer elements in host' };
    }

    const samples = [];
    for (const layer of layers) {
      const style = window.getComputedStyle(layer);
      samples.push({
        className: layer.className.baseVal ?? layer.className,
        animationName: style.animationName,
        animationPlayState: style.animationPlayState,
        animationDuration: style.animationDuration,
      });
    }

    const animated = samples.filter((s) => s.animationName && s.animationName !== 'none');
    const running = animated.filter((s) => s.animationPlayState === 'running');

    return {
      ok: animated.length >= 34 && running.length >= 34,
      layerCount: layers.length,
      animatedCount: animated.length,
      runningCount: running.length,
      sample: samples.slice(0, 3),
    };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
