import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';
import { chromium } from 'playwright';

const staticDirectory =
  process.env.LIQUID_COMMAND_STATIC_DIR ?? '/tmp/caresuite-liquid-web-20260727';
const outputDirectory =
  process.env.LIQUID_COMMAND_QA_DIR ?? '/tmp/caresuite-liquid-command-qa';
const port = Number(process.env.LIQUID_COMMAND_QA_PORT ?? 4173);
const browserExecutable = process.env.LIQUID_COMMAND_BROWSER_EXECUTABLE;
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
    : [raw, `${raw}.html`, join(raw, 'index.html')];
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
  });
  createReadStream(path).pipe(response);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

const targets = [
  {
    name: 'desktop-login',
    path: '/auth',
    viewport: { width: 1440, height: 900 },
    expected: 'CareSuite HealthOS',
  },
  {
    name: 'tablet-landscape-business',
    path: '/auth/business-login',
    viewport: { width: 1180, height: 820 },
    expected: 'CareSuite HealthOS',
  },
  {
    name: 'tablet-portrait-register',
    path: '/auth/register',
    viewport: { width: 820, height: 1180 },
    expected: 'Organisation',
  },
  {
    name: 'phone-portrait-login',
    path: '/auth',
    viewport: { width: 390, height: 844 },
    expected: 'CareSuite HealthOS',
  },
  {
    name: 'phone-employee-portal-login',
    path: '/auth/employee-login',
    viewport: { width: 390, height: 844 },
    expected: 'Ihr Arbeitstag beginnt hier.',
  },
  {
    name: 'tablet-portrait-client-portal-login',
    path: '/auth/client-login',
    viewport: { width: 820, height: 1180 },
    expected: 'Ihre Versorgung. Klar im Blick.',
  },
];

let browser;
const failures = [];
let recoveredStaticBoundaries = 0;
try {
  browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  });
  for (const target of targets) {
    const page = await browser.newPage({ viewport: target.viewport });
    const pageErrors = [];
    page.on('pageerror', (error) => {
      if (error.message.includes('Minified React error #421')) {
        recoveredStaticBoundaries += 1;
        return;
      }
      pageErrors.push(error.message);
    });
    await page.goto(`${origin}${target.path}`, { waitUntil: 'networkidle' });
    await page.getByText(target.expected, { exact: false }).first().waitFor();
    const accessMain = page.getByTestId('liquid-access-main');
    const accessBounds = await accessMain.boundingBox();
    const minimumWidth = target.viewport.width <= 430 ? 340 : 420;
    if (!accessBounds || accessBounds.width < minimumWidth) {
      failures.push(
        `${target.name}: Zugangsinhalt kollabiert (${Math.round(accessBounds?.width ?? 0)}px statt mindestens ${minimumWidth}px).`,
      );
    }
    await page.screenshot({
      path: join(outputDirectory, `${target.name}.png`),
      fullPage: true,
    });
    if (target.name === 'desktop-login') {
      const portalChoices = page.getByRole('button').filter({ hasText: /portal|App/ });
      if ((await portalChoices.count()) < 3) failures.push('desktop-login: Portalzugänge fehlen.');
    }
    if (target.name === 'tablet-landscape-business') {
      await page.getByLabel('E-Mail', { exact: true }).fill('qa@einrichtung.de');
      await page.getByLabel('Passwort', { exact: true }).fill('LiquidCommand-QA');
      if ((await page.getByLabel('E-Mail', { exact: true }).inputValue()) !== 'qa@einrichtung.de') {
        failures.push('tablet-landscape-business: Eingabefeld ist nicht bedienbar.');
      }
    }
    if (target.name === 'tablet-portrait-register') {
      await page.getByLabel('Firmenname').fill('CareSuite QA');
      if ((await page.getByLabel('Firmenname').inputValue()) !== 'CareSuite QA') {
        failures.push('tablet-portrait-register: Registrierungsformular ist nicht bedienbar.');
      }
    }
    if (pageErrors.length) {
      failures.push(`${target.name}: ${pageErrors.join(' | ')}`);
    }
    await page.close();
  }
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(
  `Liquid Command Visual QA: OK · ${targets.length} Zielgrößen · ${recoveredStaticBoundaries} kontrollierte Static-Hydration-Recoveries · ${outputDirectory}`,
);
