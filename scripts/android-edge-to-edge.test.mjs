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
  assert.equal(once.match(/class CareSuiteWindowVisitor extends/g).length, 1);
  assert.equal(once.match(/import org.objectweb.asm.ClassVisitor/g).length, 1);
  assert.match(once, /^import com.android.build.api.instrumentation.AsmClassVisitorFactory/);
  assert.doesNotMatch(once, /apply from:/);
});

test('prebuild replaces the isolated script registration and rejects incomplete generated blocks', () => {
  const old = 'apply plugin: "com.android.application"\n\n// CareSuite: retire legacy Android window APIs in app and dependency bytecode.\napply from: file("caresuite-edge-to-edge.gradle")\n';
  const migrated = configureEdgeToEdgeGradle(old);
  assert.doesNotMatch(migrated, /apply from:/);
  assert.match(migrated, /InstrumentationScope.ALL/);
  assert.equal(configureEdgeToEdgeGradle(migrated), migrated);
  assert.throws(() => configureEdgeToEdgeGradle('// CareSuite Android window migration: begin'), /incomplete/);
});

test('prebuild installs the exact tracked Java bridge without a new dependency', () => {
  const root = mkdtempSync(join(tmpdir(), 'caresuite-window-test-'));
  try {
    installAndroidEdgeToEdge(root);
    installAndroidEdgeToEdge(root);
    for (const [source, output] of [['CareSuiteEdgeToEdge.java', 'android/app/src/main/java/app/caresuitehealthos/edge/CareSuiteEdgeToEdge.java']]) {
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
