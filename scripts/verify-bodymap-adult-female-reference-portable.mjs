import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const root = process.cwd();
const temporaryRoot = await mkdtemp(
  resolve(tmpdir(), 'caresuite-bodymap-phase6-female-portable-'),
);
const generatedAssetDirectory = resolve(temporaryRoot, 'public/bodymap3d/v2');
const committedGlbPath = resolve(
  root,
  'public/bodymap3d/v2/body-erwachsener-weiblich-v2.glb',
);
const committedQualityPath = `${committedGlbPath}.quality.json`;
const committedQaManifestPath = resolve(
  root,
  'docs/bodymap3d/qa/adult-female-four-view.json',
);
const committedQaPngPath = resolve(
  root,
  'docs/bodymap3d/qa/adult-female-four-view.png',
);

function runScript(script, environment) {
  try {
    execFileSync(process.execPath, [resolve(root, script)], {
      cwd: root,
      env: { ...process.env, ...environment },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
}

async function parseJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function inspectPng(path, label) {
  const bytes = await readFile(path);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(
    bytes.subarray(0, signature.length).equals(signature),
    `${label} besitzt keine gültige PNG-Signatur.`,
  );
  assert.equal(bytes.readUInt32BE(16), 1648, `${label}: unerwartete Breite.`);
  assert.equal(bytes.readUInt32BE(20), 1080, `${label}: unerwartete Höhe.`);
  assert.ok(bytes.length > 100_000, `${label} ist verdächtig klein.`);
  return bytes.length;
}

try {
  runScript('scripts/generate-bodymap-adult-female-reference-glb.mjs', {
    BODYMAP3D_REFERENCE_OUTPUT_DIR: generatedAssetDirectory,
  });
  runScript('scripts/render-bodymap-adult-female-reference-qa.mjs', {
    BODYMAP3D_QA_OUTPUT_ROOT: temporaryRoot,
  });

  const generatedGlbPath = resolve(
    generatedAssetDirectory,
    'body-erwachsener-weiblich-v2.glb',
  );
  const generatedQualityPath = `${generatedGlbPath}.quality.json`;
  const generatedQaManifestPath = resolve(
    temporaryRoot,
    'docs/bodymap3d/qa/adult-female-four-view.json',
  );
  const generatedQaPngPath = resolve(
    temporaryRoot,
    'docs/bodymap3d/qa/adult-female-four-view.png',
  );

  const [committedGlb, generatedGlb] = await Promise.all([
    readFile(committedGlbPath),
    readFile(generatedGlbPath),
  ]);
  assert.ok(
    committedGlb.equals(generatedGlb),
    'Die weiblichen GLB-Bytes weichen vom eingecheckten Asset ab.',
  );
  assert.deepEqual(
    await parseJson(committedQualityPath),
    await parseJson(generatedQualityPath),
    'Der semantische weibliche GLB-Qualitätsbericht weicht ab.',
  );
  assert.deepEqual(
    await parseJson(committedQaManifestPath),
    await parseJson(generatedQaManifestPath),
    'Das semantische weibliche Vieransichten-QA-Manifest weicht ab.',
  );

  const [committedPngBytes, generatedPngBytes] = await Promise.all([
    inspectPng(committedQaPngPath, 'Eingecheckte weibliche Vieransichten-QA'),
    inspectPng(generatedQaPngPath, 'Neu erzeugte weibliche Vieransichten-QA'),
  ]);
  const generatedSvg = await readFile(
    resolve(
      temporaryRoot,
      'artifacts/bodymap-adult-female-reference-qa/adult-female-four-view.svg',
    ),
    'utf8',
  );
  assert.match(generatedSvg, /NICHT MEDIZINISCH FREIGEGEBEN/);
  assert.match(generatedSvg, /118 Zonen/);
  assert.match(generatedSvg, /27197 Vertices/);
  assert.match(generatedSvg, /47532 Dreiecke/);

  const committedStats = await stat(committedGlbPath);
  assert.equal(committedStats.size, generatedGlb.length);

  console.log('Plattformneutrale weibliche Phase-6-Artefaktprüfung bestanden.');
  console.log(`GLB: ${generatedGlb.length} Bytes bytegenau identisch`);
  console.log('JSON: Qualitätsbericht und QA-Manifest semantisch identisch');
  console.log(
    `PNG: 1648×1080 gültig (eingecheckt ${committedPngBytes} Bytes, lokal ${generatedPngBytes} Bytes)`,
  );
  console.log('Windows-/Linux-Kompressionsunterschiede verändern keine Freigabe.');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
