import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';
import { chromium } from 'playwright';

const staticDirectory =
  process.env.BODYMAP_R7_STATIC_DIR ?? '/tmp/caresuite-bodymap-r7-web';
const outputDirectory =
  process.env.BODYMAP_R7_QA_DIR ?? 'artifacts/bodymap-r7-qa';
const port = Number(process.env.BODYMAP_R7_QA_PORT ?? 4179);
const browserExecutable = process.env.BODYMAP_R7_BROWSER_EXECUTABLE;
const origin = `http://127.0.0.1:${port}`;

await mkdir(outputDirectory, { recursive: true });

const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveStaticPath(url) {
  const requestPath = decodeURIComponent(new URL(url, origin).pathname).replace(/^\/+/, '');
  const raw = join(staticDirectory, requestPath);
  const candidates = requestPath.endsWith('/')
    ? [join(raw, 'index.html')]
    : [raw, `${raw}.html`, join(raw, 'index.html'), join(staticDirectory, 'index.html')];
  return candidates.find((candidate) => {
    if (!candidate.startsWith(staticDirectory) || !existsSync(candidate)) return false;
    return statSync(candidate).isFile();
  });
}

const server = createServer((request, response) => {
  const path = resolveStaticPath(request.url ?? '/');
  if (!path) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(path)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(path).pipe(response);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

const portalSession = {
  sessionToken: 'bodymap-r7-visual-qa',
  tenantId: 'tenant-demo-001',
  loginType: 'employee',
  roleKey: 'business_admin',
  expiresAt: '2099-12-31T23:59:59.000Z',
  accountId: 'bodymap-r7-qa',
  displayName: 'BodyMap QA',
  tenantName: 'CareSuite QA',
};

const targets = [
  { name: 'desktop', viewport: { width: 1600, height: 1000 } },
  { name: 'tablet-landscape', viewport: { width: 1180, height: 820 } },
  { name: 'tablet-portrait', viewport: { width: 820, height: 1180 } },
  { name: 'phone-portrait', viewport: { width: 390, height: 844 } },
];

const failures = [];
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
    args: [
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-angle=swiftshader',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  for (const target of targets) {
    const context = await browser.newContext({
      viewport: target.viewport,
      colorScheme: 'dark',
      deviceScaleFactor: 1,
    });
    await context.addInitScript((session) => {
      window.localStorage.setItem('caresuite.portal.session.v1', JSON.stringify(session));
    }, portalSession);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`${origin}/pflege/bodymap?clientId=client-001`, {
      waitUntil: 'networkidle',
      timeout: 120_000,
    });

    const workspace = page.getByTestId('bodymap-liquid-workspace');
    try {
      await workspace.waitFor({ state: 'visible', timeout: 30_000 });
    } catch {
      failures.push(
        `${target.name}: BodyMap-Arbeitsfläche fehlt; aktuelle Route ${page.url()}.`,
      );
      await page.screenshot({
        path: join(outputDirectory, `${target.name}-failure.png`),
        fullPage: true,
      });
      await context.close();
      continue;
    }

    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 60_000 });
    await page.waitForTimeout(1800);

    const overflow = await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth -
        globalThis.document.documentElement.clientWidth,
    );
    if (overflow > 2) {
      failures.push(`${target.name}: horizontaler Überlauf ${overflow}px.`);
    }

    for (const label of [
      'Körperkarte drehen',
      'Befundpunkt setzen',
      'Ansicht zurücksetzen',
      'Vergrößern',
      'Verkleinern',
      'Ganzkörper zentrieren',
    ]) {
      if ((await page.getByLabel(label, { exact: true }).count()) !== 1) {
        failures.push(`${target.name}: Werkzeug „${label}“ fehlt oder ist doppelt.`);
      }
    }

    await page.getByLabel('Körperkarte drehen', { exact: true }).click();
    await page.getByLabel('Befundpunkt setzen', { exact: true }).click();
    if (await page.getByLabel('Befundpunkt setzen', { exact: true }).isDisabled()) {
      failures.push(`${target.name}: Zielwerkzeug lässt sich nach Rotation nicht aktivieren.`);
    }

    const canvasBounds = await page.locator('canvas').first().boundingBox();
    if (!canvasBounds || canvasBounds.width < Math.min(320, target.viewport.width - 40)) {
      failures.push(`${target.name}: 3D-Fläche ist zu schmal.`);
    }
    if (!canvasBounds || canvasBounds.height < 420) {
      failures.push(`${target.name}: 3D-Fläche ist gestaucht.`);
    }

    await page.screenshot({
      path: join(outputDirectory, `${target.name}.png`),
      fullPage: true,
    });

    if (pageErrors.length) {
      failures.push(`${target.name}: ${pageErrors.join(' | ')}`);
    }
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`BodyMap R7 visuelle QA bestanden: ${targets.length}/${targets.length}`);
console.log(`Screenshots: ${outputDirectory}`);
