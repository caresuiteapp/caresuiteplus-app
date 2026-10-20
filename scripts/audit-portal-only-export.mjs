import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const exportRoot = resolve(process.argv[2] ?? 'dist-portal-only');
const MAX_RUNTIME_BYTES = 50 * 1024 * 1024;

function fail(message) {
  console.error(`Portal-only export audit failed: ${message}`);
  process.exit(1);
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolute) : [absolute];
  });
}

if (!existsSync(exportRoot) || !statSync(exportRoot).isDirectory()) {
  fail(`export directory does not exist: ${exportRoot}`);
}

const files = listFiles(exportRoot);
const relativeFiles = files.map((file) => relative(exportRoot, file).replaceAll('\\', '/'));
const runtimeFiles = files.filter((file) => !file.endsWith('.map'));
const runtimeBytes = runtimeFiles.reduce((sum, file) => sum + statSync(file).size, 0);

const forbiddenStaticPatterns = [
  /bodymap3d/i,
  /access-administration/i,
  /healthos-widget/i,
  /(?:^|\/)websites(?:\/|$)/i,
];
const forbiddenStaticFiles = relativeFiles.filter((file) =>
  forbiddenStaticPatterns.some((pattern) => pattern.test(file)),
);

if (forbiddenStaticFiles.length > 0) {
  fail(`forbidden desktop assets found:\n${forbiddenStaticFiles.join('\n')}`);
}
if (runtimeBytes > MAX_RUNTIME_BYTES) {
  fail(
    `runtime export is ${(runtimeBytes / 1024 / 1024).toFixed(1)} MB; limit is ${(
      MAX_RUNTIME_BYTES /
      1024 /
      1024
    ).toFixed(0)} MB`,
  );
}

const sourceMapFiles = files.filter((file) => file.endsWith('.map'));
if (sourceMapFiles.length === 0) {
  fail('source map missing; build the audit export with --source-maps');
}

const sources = sourceMapFiles.flatMap((file) => {
  const sourceMap = JSON.parse(readFileSync(file, 'utf8'));
  return Array.isArray(sourceMap.sources)
    ? sourceMap.sources.map((source) => source.replaceAll('\\', '/'))
    : [];
});

const forbiddenSourcePatterns = [
  /(?:^|\/)app-portal\/(?:business|office|assist|settings|admin|platform)(?:\/|$)/,
  /(?:^|\/)app\/(?!portal\/)/,
  /(?:^|\/)src\/screens\/(?:admin|assist|business|office|settings|platform)(?:\/|$)/,
  /CommandCenterScreen/,
  /LiquidCommandShell/,
  /src\/components\/layout\/index\.ts$/,
  /src\/components\/layout\/platform\/index\.ts$/,
];
const forbiddenSources = [...new Set(
  sources.filter((source) => forbiddenSourcePatterns.some((pattern) => pattern.test(source))),
)];

if (forbiddenSources.length > 0) {
  fail(`forbidden administration sources found:\n${forbiddenSources.join('\n')}`);
}

const portalRouteSources = sources.filter((source) => /(?:^|\/)app-portal\//.test(source));
const reusedPortalSources = sources.filter((source) => /(?:^|\/)app\/portal\//.test(source));
if (portalRouteSources.length < 40 || reusedPortalSources.length < 40) {
  fail('portal route graph is incomplete');
}

// Verify every v1.3 offline intro against the approved media manifest.
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const introManifest = JSON.parse(readFileSync(resolve('assets/brand/intro/manifest.json'), 'utf8'));
if (introManifest.version !== '1.3' || introManifest.durationSeconds !== 8 || introManifest.formats.length !== 6) {
  fail('expected the complete eight-second v1.3 intro with six formats');
}
const introAssets = introManifest.formats.map((format) => {
  const source = resolve('assets/brand/intro', format.file);
  if (!existsSync(source)) fail(`intro source missing: ${format.id}`);
  const bytes = statSync(source).size;
  const digest = sha256(source);
  if (digest !== format.sha256) fail(`intro differs from approved v1.3 media: ${format.id}`);
  const packaged = runtimeFiles.find((file) => statSync(file).size === bytes && sha256(file) === digest);
  if (!packaged) fail(`offline intro video not packaged intact: ${format.id}`);
  return { format: format.id, bytes, sha256: digest, packaged: relative(exportRoot, packaged) };
});
if (!sources.some((source) => source.endsWith('/AppStartIntro.native.tsx'))) {
  fail('native startup intro is missing from the Android route graph');
}

console.log(
  JSON.stringify(
    {
      status: 'ok',
      export: basename(exportRoot),
      runtimeSizeMb: Number((runtimeBytes / 1024 / 1024).toFixed(1)),
      runtimeFiles: runtimeFiles.length,
      bundledSources: sources.length,
      portalRoutes: portalRouteSources.length,
      reusedPortalRoutes: reusedPortalSources.length,
      excludedAdministrationSources: true,
      excludedDesktopAssets: true,
      introAssets,
    },
    null,
    2,
  ),
);
