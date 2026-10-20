import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { DIVERS_REFERENCE_VARIANTS } from './lib/bodymap-divers-reference-glb.mjs';

const root = process.cwd();
const temporaryRoot = await mkdtemp(resolve(tmpdir(), 'caresuite-bodymap-phase8-divers-'));
const generatedAssetDirectory = resolve(temporaryRoot, 'public/bodymap3d/v2');

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
  assert.ok(
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    `${label}: ungültige PNG-Signatur.`,
  );
  assert.equal(bytes.readUInt32BE(16), 1648);
  assert.equal(bytes.readUInt32BE(20), 1080);
  assert.ok(bytes.length > 100_000);
  return bytes.length;
}

try {
  runScript('scripts/generate-bodymap-divers-reference-glbs.mjs', {
    BODYMAP3D_REFERENCE_OUTPUT_DIR: generatedAssetDirectory,
  });
  runScript('scripts/render-bodymap-divers-reference-qa.mjs', {
    BODYMAP3D_QA_OUTPUT_ROOT: temporaryRoot,
  });
  const results = [];
  for (const configuration of DIVERS_REFERENCE_VARIANTS) {
    const artifactName = `${configuration.id.replace(/^body-/, '')}-four-view`;
    const artifactDirectoryName =
      `bodymap-${configuration.id.replace(/^body-/, '')}-reference-qa`;
    const committedGlbPath = resolve(root, 'public/bodymap3d/v2', configuration.fileName);
    const generatedGlbPath = resolve(generatedAssetDirectory, configuration.fileName);
    const committedGlb = await readFile(committedGlbPath);
    const generatedGlb = await readFile(generatedGlbPath);
    assert.ok(committedGlb.equals(generatedGlb), `${configuration.id}: GLB weicht ab.`);
    assert.deepEqual(
      await parseJson(`${committedGlbPath}.quality.json`),
      await parseJson(`${generatedGlbPath}.quality.json`),
    );
    assert.deepEqual(
      await parseJson(resolve(root, 'docs/bodymap3d/qa', `${artifactName}.json`)),
      await parseJson(resolve(temporaryRoot, 'docs/bodymap3d/qa', `${artifactName}.json`)),
    );
    const pngBytes = await inspectPng(
      resolve(root, 'docs/bodymap3d/qa', `${artifactName}.png`),
      configuration.id,
    );
    await inspectPng(
      resolve(temporaryRoot, 'docs/bodymap3d/qa', `${artifactName}.png`),
      `${configuration.id} neu`,
    );
    const svg = await readFile(
      resolve(temporaryRoot, 'artifacts', artifactDirectoryName, `${artifactName}.svg`),
      'utf8',
    );
    assert.match(svg, /NICHT MEDIZINISCH FREIGEGEBEN/);
    assert.match(svg, /PRODUKTIVER FALLBACK BLEIBT AKTIV/);
    results.push({ id: configuration.id, glbBytes: committedGlb.length, pngBytes });
  }
  console.log('Plattformneutrale Phase-8-Diversartefaktprüfung bestanden.');
  for (const result of results) {
    console.log(`${result.id}: GLB ${result.glbBytes} Bytes · QA ${result.pngBytes} Bytes`);
  }
  console.log('8/8 GLBs bytegenau · 8/8 JSON semantisch · 8/8 PNG/SVG gültig');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
