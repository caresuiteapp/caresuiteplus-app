/* global URL, document */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';

function valueOf(name) {
  return process.argv
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

const root = process.cwd();
const variantId = valueOf('variant') ?? 'body-erwachsener-maennlich';
const buildRoot = resolve(
  valueOf('build') ?? process.env.BODYMAP_QA_BUILD_DIR ?? 'dist-bodymap3d-phase5',
);
const outputDirectory = resolve(
  valueOf('output') ??
    process.env.BODYMAP_QA_OUTPUT_DIR ??
    'artifacts/bodymap-mesh-workbench',
);
const outputFile = resolve(outputDirectory, `${variantId}-four-view.png`);
const manifestFile = resolve(outputDirectory, `${variantId}-capture.json`);
const readyTimeout = Number(process.env.BODYMAP_QA_READY_TIMEOUT ?? 120_000);
const canvasTimeout = Number(process.env.BODYMAP_QA_CANVAS_TIMEOUT ?? 120_000);

await mkdir(outputDirectory, { recursive: true });

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.ico': 'image/x-icon',
};
const server = createServer(async (request, response) => {
  try {
    const requestPath = decodeURIComponent(
      new URL(request.url ?? '/', 'http://127.0.0.1').pathname,
    ).replace(/^\/+/, '');
    let filePath = resolve(buildRoot, requestPath || 'index.html');
    if (filePath !== buildRoot && !filePath.startsWith(`${buildRoot}${sep}`)) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Ungültiger Pfad');
      return;
    }
    try {
      if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html');
    } catch {
      try {
        const routeFile = `${filePath}.html`;
        await stat(routeFile);
        filePath = routeFile;
      } catch {
        filePath = join(buildRoot, 'index.html');
      }
    }
    const bytes = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(bytes);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(String(error));
  }
});

await new Promise((resolveListen, rejectListen) => {
  server.once('error', rejectListen);
  server.listen(0, '127.0.0.1', resolveListen);
});
const address = server.address();
if (!address || typeof address === 'string') {
  throw new Error('Lokaler Workbench-Server konnte keinen Port bereitstellen.');
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
  args:
    process.env.BODYMAP_QA_SAFE_BROWSER === '1'
      ? [
          '--no-sandbox',
          '--single-process',
          '--no-zygote',
          '--disable-dev-shm-usage',
          '--enable-webgl',
          '--ignore-gpu-blocklist',
          '--use-gl=swiftshader',
        ]
      : [
          '--enable-webgl',
          '--ignore-gpu-blocklist',
          '--use-angle=swiftshader',
          '--disable-dev-shm-usage',
        ],
});
const context = await browser.newContext({
  viewport: { width: 1800, height: 1450 },
  deviceScaleFactor: 1,
  colorScheme: 'dark',
});
const page = await context.newPage();
const browserErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(message.text());
});

const url = `http://127.0.0.1:${address.port}/bodymap-mesh-workbench?variant=${encodeURIComponent(variantId)}`;
await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
try {
  await page.getByTestId('bodymap-mesh-workbench-ready').waitFor({
    state: 'visible',
    timeout: readyTimeout,
  });
} catch (error) {
  console.error('Workbench-Route:', page.url());
  console.error('Workbench-Titel:', await page.title());
  console.error(
    'Workbench-Text:',
    (await page.locator('body').innerText().catch(() => '')).slice(0, 1200),
  );
  console.error('Browserfehler:', browserErrors);
  throw error;
}
try {
  await page.waitForFunction(
    () => {
      const canvases = Array.from(document.querySelectorAll('canvas'));
      return (
        canvases.length === 4 &&
        canvases.every((canvas) => canvas.width > 100 && canvas.height > 100)
      );
    },
    undefined,
    { timeout: canvasTimeout },
  );
} catch (error) {
  console.error(
    'Canvas-Diagnose:',
    await page.evaluate(() =>
      Array.from(document.querySelectorAll('canvas')).map((canvas) => ({
        width: canvas.width,
        height: canvas.height,
      })),
    ),
  );
  console.error('Browserfehler:', browserErrors);
  throw error;
}
await page.waitForTimeout(1800);

const canvasState = await page.evaluate(() =>
  Array.from(document.querySelectorAll('canvas')).map((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    dataLength: canvas.toDataURL('image/png').length,
  })),
);
const statusText = await page.locator('body').innerText();
await page.screenshot({ path: outputFile, fullPage: true });
await browser.close();
await new Promise((resolveClose, rejectClose) => {
  server.close((error) => (error ? rejectClose(error) : resolveClose()));
});

const result = {
  generatedAt: new Date().toISOString(),
  variantId,
  url,
  outputFile: relative(root, outputFile).replaceAll(sep, '/'),
  viewport: { width: 1800, height: 1450, deviceScaleFactor: 1 },
  canvasState,
  rendererStatusVisible:
    statusText.includes('Real-Human 3D') ||
    statusText.includes('Technisches GLB-Referenzmesh · kontinuierliche Oberfläche'),
  technicalReviewVisible: statusText.includes('technical-review'),
  medicalReleaseStillPending: statusText.includes('Medizinisch geprüft'),
  browserErrors,
};
await writeFile(manifestFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

console.log(`Vieransichten-Aufnahme: ${outputFile}`);
console.log(`Canvas: ${canvasState.length}/4`);
console.log(`Technisches Referenzmesh sichtbar: ${result.rendererStatusVisible ? 'JA' : 'NEIN'}`);
console.log(`Browserfehler: ${browserErrors.length}`);
if (
  canvasState.length !== 4 ||
  !result.rendererStatusVisible ||
  !result.technicalReviewVisible ||
  browserErrors.length
) {
  process.exit(1);
}
