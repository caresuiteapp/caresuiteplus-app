import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { effectiveMemoryMiB, memoryPlan, writeMemoryConfiguration, verifyMemoryProof } from './configure-healthos-gradle-memory.mjs';

const MIB = 1024 * 1024;
const commit = 'd1f128b8a8948d009837a61ecab179989de221cf';

test('the smaller cgroup limit wins over host RAM, including v1 unlimited sentinels', () => {
  assert.equal(effectiveMemoryMiB(32768 * MIB, ['max', String(8192 * MIB)]), 8192);
  assert.equal(effectiveMemoryMiB(32768 * MIB, ['9223372036854771712', String(7168 * MIB)]), 7168);
  assert.equal(effectiveMemoryMiB(16384 * MIB, ['max']), 16384);
});

test('invalid memory limits fail rather than silently using the larger host', () => {
  for (const value of ['unknown', '-1', '0']) assert.throws(() => effectiveMemoryMiB(16384 * MIB, [value]));
  assert.throws(() => effectiveMemoryMiB(NaN));
});

for (const ramMiB of [6400, 7168, 8192, 12288, 16384, 32768]) {
  test(`R8 memory plan leaves headroom and bounds workers on ${ramMiB} MiB`, () => {
    const plan = memoryPlan(ramMiB);
    assert.ok(plan.heapMiB >= 4096);
    assert.ok(plan.heapMiB + plan.metaspaceMiB + 1280 <= ramMiB);
    assert.equal(plan.workers, ramMiB < 12288 ? 1 : 2);
    assert.equal(plan.parallelProjects, false);
  });
}

test('undersized runners fail before credentials or native compilation', () => {
  for (const ramMiB of [2048, 4096, 6399, NaN]) assert.throws(() => memoryPlan(ramMiB));
});

for (const ramMiB of [8192, 16384]) {
  test(`the installed Java accepts and actually applies the ${ramMiB} MiB runner plan`, () => {
    const plan = memoryPlan(ramMiB);
    const flags = execFileSync('java', [...plan.jvmArgs.split(' '), '-XX:+PrintFlagsFinal', '-version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const actualHeap = Number(flags.match(/\bMaxHeapSize\s*=\s*(\d+)/)?.[1]);
    const actualMeta = Number(flags.match(/\bMaxMetaspaceSize\s*=\s*(\d+)/)?.[1]);
    assert.equal(actualHeap / MIB, plan.heapMiB);
    assert.equal(actualMeta / MIB, plan.metaspaceMiB);
    assert.match(flags, /\bUseParallelGC\s*=\s*true/);
  });
}

function fixture(callback) {
  const dir = mkdtempSync(join(tmpdir(), "healthos-r8-Kevin's test "));
  try { callback(dir); }
  finally { rmSync(dir, { force: true, recursive: true, maxRetries: 3 }); }
}

test('the dedicated Gradle home is idempotent and its runtime probe safely handles spaces and quotes', () => fixture(dir => {
  const gradleHome = join(dir, 'gradle');
  const file = join(dir, 'BUILD-MEMORY.json');
  const plan = memoryPlan(16384);
  const first = writeMemoryConfiguration(gradleHome, file, plan, commit);
  assert.deepEqual(writeMemoryConfiguration(gradleHome, file, plan, commit), first);
  const properties = Object.fromEntries(readFileSync(first.propertiesFile, 'utf8').split('\n').filter(line => !line.startsWith('#') && line.includes('=')).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assert.equal(properties['org.gradle.jvmargs'], plan.jvmArgs);
  assert.equal(properties['org.gradle.workers.max'], String(plan.workers));
  assert.equal(properties['org.gradle.parallel'], 'false');
  const probe = readFileSync(join(gradleHome, 'init.d/caresuite-healthos-memory.gradle'), 'utf8');
  assert.ok(probe.includes("Kevin\\'s test"));
  assert.ok(!probe.includes('${'));
  assert.ok(probe.includes("+ '\\n'"));
}));

test('existing unrelated Gradle configuration is preserved', () => fixture(dir => {
  const gradleHome = join(dir, 'gradle');
  mkdirSync(gradleHome);
  const file = join(gradleHome, 'gradle.properties');
  const original = 'org.gradle.jvmargs=-Xmx2048m\ncustom.setting=preserve\n';
  writeFileSync(file, original);
  assert.throws(() => writeMemoryConfiguration(gradleHome, join(dir, 'PLAN.json'), memoryPlan(16384), commit));
  assert.equal(readFileSync(file, 'utf8'), original);
}));

for (const [name, changed] of [
  ['old two-GiB heap', { heapMiB: 2048 }],
  ['old 512-MiB metaspace', { metaspaceMiB: 512 }],
  ['another commit', { commit: '0'.repeat(40) }],
  ['excess workers', { workers: 4 }],
  ['parallel projects', { parallelProjects: true }],
  ['wrong collector', { parallelGc: false }],
]) {
  test(`a runtime proof with ${name} is rejected`, () => fixture(dir => {
    const plan = memoryPlan(16384);
    const file = join(dir, 'BUILD-MEMORY.json');
    const info = writeMemoryConfiguration(join(dir, 'gradle'), file, plan, commit);
    writeFileSync(info.proofFile, JSON.stringify({ commit, heapMiB: plan.heapMiB, metaspaceMiB: plan.metaspaceMiB, workers: plan.workers, parallelProjects: false, parallelGc: true, ...changed }));
    assert.throws(() => verifyMemoryProof(file));
  }));
}

test('only a runtime proof for the expected source and budget is accepted', () => fixture(dir => {
  const plan = memoryPlan(16384);
  const file = join(dir, 'BUILD-MEMORY.json');
  const info = writeMemoryConfiguration(join(dir, 'gradle'), file, plan, commit);
  const proof = { commit, heapMiB: plan.heapMiB, metaspaceMiB: plan.metaspaceMiB, workers: 2, parallelProjects: false, parallelGc: true, javaVersion: '17', gradleVersion: '9.3.1' };
  writeFileSync(info.proofFile, JSON.stringify(proof));
  assert.deepEqual(verifyMemoryProof(file, commit), proof);
  assert.throws(() => verifyMemoryProof(file, '0'.repeat(40)));
}));
