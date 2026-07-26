import { chromium } from 'playwright';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const root = process.cwd();
const modelManifest = JSON.parse(
  await readFile(resolve(root, 'assets/bodymap3d/v1/model-manifest.json'), 'utf8'),
);
const medicalManifest = JSON.parse(
  await readFile(
    resolve(root, 'assets/bodymap3d/v2/medical-mesh-manifest.json'),
    'utf8',
  ),
);
const extraDiversCases = medicalManifest.variants
  .map((entry) => entry.id)
  .filter((id) => !modelManifest.baseModelIds.includes(id));
const cases = [...modelManifest.baseModelIds, ...extraDiversCases];
const buildDirectory =
  process.env.BODYMAP_QA_BUILD_DIR ?? resolve(root, '.bodymap-visual-qa-build');
const outputDirectory =
  process.env.BODYMAP_QA_OUTPUT_DIR ??
  resolve(root, 'artifacts/bodymap-visual-comparison/images');
const buildRoot = resolve(buildDirectory);
const requestedLimit = Number(
  process.argv.find((argument) => argument.startsWith('--limit='))?.split('=')[1] ??
    cases.length,
);
const requestedVariant = process.argv
  .find((argument) => argument.startsWith('--variant='))
  ?.slice('--variant='.length);
if (requestedVariant && !cases.includes(requestedVariant)) {
  throw new Error(`Unbekannte QA-Variante: ${requestedVariant}`);
}
const selectedCases = requestedVariant
  ? [requestedVariant]
  : cases.slice(0, Math.max(1, Math.min(cases.length, requestedLimit)));

await mkdir(outputDirectory, { recursive: true });

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
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
      filePath = join(buildRoot, 'index.html');
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
const serverAddress = server.address();
if (!serverAddress || typeof serverAddress === 'string') {
  throw new Error('Lokaler QA-Server konnte keinen Port bereitstellen.');
}
const baseUrl = `http://127.0.0.1:${serverAddress.port}`;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BODYMAP_QA_CHROMIUM_EXECUTABLE || undefined,
  args: [
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-angle=swiftshader',
    '--disable-dev-shm-usage',
    '--disable-crash-reporter',
    '--disable-crashpad',
    '--no-sandbox',
    '--disable-setuid-sandbox',
  ],
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1400 },
  deviceScaleFactor: 1,
  colorScheme: 'dark',
});
const page = await context.newPage();
const results = [];

for (let index = 0; index < selectedCases.length; index += 1) {
  const variantId = selectedCases[index];
  const url = `${baseUrl}/bodymap-visual-qa?variant=${encodeURIComponent(variantId)}`;
  const browserErrors = [];
  const onConsole = (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  };
  page.on('console', onConsole);

  await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.getByTestId('bodymap-visual-qa-ready').waitFor({
    state: 'visible',
    timeout: 120_000,
  });
  await page.waitForFunction(
    () => {
      const canvases = Array.from(document.querySelectorAll('canvas'));
      return (
        canvases.length === 4 &&
        canvases.every((canvas) => canvas.width > 100 && canvas.height > 100)
      );
    },
    undefined,
    { timeout: 120_000 },
  );
  await page.waitForTimeout(1200);

  const filename = `${String(index + 1).padStart(2, '0')}-${variantId}.png`;
  const outputPath = resolve(outputDirectory, filename);
  await page.screenshot({ path: outputPath, fullPage: true });
  const canvasState = await page.evaluate(() =>
    Array.from(document.querySelectorAll('canvas')).map((canvas) => ({
      width: canvas.width,
      height: canvas.height,
      dataLength: canvas.toDataURL('image/png').length,
    })),
  );
  results.push({
    index: index + 1,
    variantId,
    filename,
    url,
    canvasState,
    browserErrors,
  });
  page.off('console', onConsole);
  console.log(`[${index + 1}/${selectedCases.length}] ${filename}`);
}

await browser.close();
await new Promise((resolveClose, rejectClose) => {
  server.close((error) => (error ? rejectClose(error) : resolveClose()));
});
await writeFile(
  resolve(outputDirectory, '..', 'capture-manifest.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      renderer: 'CareSuite ParametricBodyModel via Expo Web/Three.js',
      viewport: { width: 1600, height: 1400, deviceScaleFactor: 1 },
      totalExpected: cases.length,
      totalCaptured: results.length,
      results,
    },
    null,
    2,
  )}\n`,
  'utf8',
);
