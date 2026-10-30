import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { configureEdgeToEdgeGradle, installAndroidEdgeToEdge } = require('../plugins/androidEdgeToEdge.cjs');

test('repeated prebuilds register exactly one app/dependency rewrite', () => {
  const once = configureEdgeToEdgeGradle('plugins { id "com.android.application" }\n');
  assert.equal(configureEdgeToEdgeGradle(once), once);
  assert.equal(once.match(/apply from:/g).length, 1);
});

test('prebuild installs the exact tracked Java bridge and Gradle visitor without a new dependency', () => {
  const root = mkdtempSync(join(tmpdir(), 'caresuite-window-test-'));
  try {
    installAndroidEdgeToEdge(root);
    installAndroidEdgeToEdge(root);
    for (const [source, output] of [['android-edge-to-edge.gradle', 'android/app/caresuite-edge-to-edge.gradle'], ['CareSuiteEdgeToEdge.java', 'android/app/src/main/java/app/caresuitehealthos/edge/CareSuiteEdgeToEdge.java']]) {
      assert.equal(readFileSync(join(root, output), 'utf8'), readFileSync(new URL('../plugins/android-edge-to-edge/' + source, import.meta.url), 'utf8'));
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('window migration includes binary dependencies and excludes its own cutout store', () => {
  const gradle = readFileSync(new URL('../plugins/android-edge-to-edge/android-edge-to-edge.gradle', import.meta.url), 'utf8');
  assert.match(gradle, /InstrumentationScope\.ALL/);
  assert.match(gradle, /!data\.className\.startsWith\('app\.caresuitehealthos\.edge\.CareSuiteEdgeToEdge'\)/);
  assert.match(gradle, /verifyCareSuiteEdgeToEdgeRewrite/);
  assert.doesNotMatch(gradle, /\bdependencies\s*\{/);
  const java = readFileSync(new URL('../plugins/android-edge-to-edge/CareSuiteEdgeToEdge.java', import.meta.url), 'utf8');
  assert.doesNotMatch(java, /\.(?:getStatusBarColor|getNavigationBarColor|setStatusBarColor|setNavigationBarColor)\(/);
  assert.doesNotMatch(java, /LAYOUT_IN_DISPLAY_CUTOUT_MODE_(?:DEFAULT|SHORT_EDGES)/);
  assert.match(java, /WindowInsetsCompat\.Type\.statusBars\(\)/);
  assert.match(java, /WindowInsetsCompat\.Type\.navigationBars\(\)/);
});
