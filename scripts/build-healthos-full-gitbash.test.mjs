import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseCredentials, versionPlan, checkReserved, signingGradle, localSigningInit, sdkComponents, sameDependencies, installedPackagesMatch } from './build-healthos-full-gitbash.mjs';
import { manifestIdentity, requireIdentity, streamCommand, verifyR8Archive } from './verify-local-healthos-aab.mjs';

const commit = 'e'.repeat(40);
test('prebuild retains dependency versions independently of property order', () => {
  const before = { dependencies: { a: '1', b: '2' }, devDependencies: { c: '3' } };
  assert.ok(sameDependencies(before, { ...before, dependencies: { b: '2', a: '1' }, scripts: { android: 'expo run:android' } }));
  assert.equal(sameDependencies(before, { ...before, dependencies: { a: '2', b: '2' } }), false);
});

test('existing node_modules must match actual locked versions', () => {
  const folder = mkdtempSync(join(tmpdir(), 'healthos-packages-'));
  const lock = { packages: { '': { dependencies: { expo: '~57.0.20' } }, 'node_modules/expo': { version: '57.0.20' } } };
  try {
    assert.equal(installedPackagesMatch(folder, lock), false);
    mkdirSync(join(folder, 'node_modules/expo'), { recursive: true });
    writeFileSync(join(folder, 'node_modules/expo/package.json'), '{"version":"57.0.20"}');
    assert.ok(installedPackagesMatch(folder, lock));
    writeFileSync(join(folder, 'node_modules/expo/package.json'), '{"version":"57.0.19"}');
    assert.equal(installedPackagesMatch(folder, lock), false);
  } finally { rmSync(folder, { recursive: true }); }
});
test('local version reservation follows the real EAS baseline', () => {
  const plan = versionPlan({ versionCode: '42' }, commit);
  assert.deepEqual(plan, { commit, baseline: 42, versionCode: 43 });
  checkReserved(plan, { versionCode: '43' }, commit);
  for (const remote of [41, 42, 44]) assert.throws(() => checkReserved(plan, { versionCode: remote }, commit));
  assert.throws(() => checkReserved(plan, { versionCode: 43 }, 'f'.repeat(40)));
  for (const value of [undefined, 39, 42.5, 'x', 2100000000]) assert.throws(() => versionPlan({ versionCode: value }, commit));
});

test('local release identity excludes wrong app, edition and reused versions', () => {
  const identity = { applicationId: 'app.caresuitehealthos', versionName: '0.4.0', versionCode: 43 };
  requireIdentity(identity, 42);
  for (const changed of [{ applicationId: 'com.helloworld' }, { versionName: '0.3.7' }, { versionCode: 42 }, { versionCode: 0 }, { versionCode: 2100000001 }]) assert.throws(() => requireIdentity({ ...identity, ...changed }, 42));
  assert.throws(() => requireIdentity(identity, 39));
});

test('credentials use the existing Expo shape and retain literal passwords', () => {
  const input = { android: { keystore: { keystorePath: 'keys/upload.jks', keystorePassword: 'private $() ! value', keyAlias: 'existing', keyPassword: 'second\nliteral' } } };
  const credentialFile = join(resolve(tmpdir(), 'a native folder'), 'credentials.json');
  const values = parseCredentials(input, credentialFile);
  assert.equal(values.file, join(resolve(tmpdir(), 'a native folder'), 'keys', 'upload.jks'));
  assert.equal(values.storePassword, input.android.keystore.keystorePassword);
  assert.equal(values.keyPassword, input.android.keystore.keyPassword);
  for (const name of ['keystorePath', 'keystorePassword', 'keyAlias', 'keyPassword']) {
    const broken = structuredClone(input); delete broken.android.keystore[name];
    assert.throws(() => parseCredentials(broken, '/a/credentials.json'));
  }
});

test('generated release signing passes secrets through environment variables', () => {
  const generated = signingGradle(43);
  assert.match(generated, /versionCode 43/);
  assert.match(generated, /signingConfig signingConfigs.release/);
  for (const name of ['STORE_FILE', 'STORE_PASSWORD', 'KEY_ALIAS', 'KEY_PASSWORD']) assert.ok(generated.includes('CARESUITE_LOCAL_' + name));
  assert.doesNotMatch(generated, /storePassword\s+['"]|keyPassword\s+['"]/);
  assert.throws(() => signingGradle(40));
});

test('existing SDK components must match the compiled release', () => {
  const folder = mkdtempSync(join(tmpdir(), 'healthos-sdk-'));
  try {
    assert.deepEqual(sdkComponents(folder, true), { api36: false, buildTools36: false, ndk27: false, cmake322: false });
    for (const name of ['platforms/android-36/android.jar', 'build-tools/36.0.0/aapt2.exe', 'ndk/27.1.12297006/source.properties', 'ndk/27.1.12297006/build/cmake/android.toolchain.cmake', 'ndk/27.1.12297006/toolchains/llvm/prebuilt/windows-x86_64/bin/clang.exe', 'cmake/3.22.1/bin/cmake.exe', 'cmake/3.22.1/bin/ninja.exe']) {
      mkdirSync(join(folder, name, '..'), { recursive: true }); writeFileSync(join(folder, name), 'fixture');
    }
    assert.deepEqual(sdkComponents(folder, true), { api36: true, buildTools36: true, ndk27: true, cmake322: true });
  } finally { rmSync(folder, { recursive: true }); }
});

test('streamed artifact readers reject tool failure and excessive output', async () => {
  await assert.rejects(streamCommand(process.execPath, ['-e', 'process.stdout.write("0123456789")'], 5, () => {}), /Prüfgrenze/);
  await assert.rejects(streamCommand(process.execPath, ['-e', 'process.exit(7)'], 100, () => {}), /Dateiprüfung/);
  await assert.rejects(streamCommand('healthos-tool-that-does-not-exist', [], 100, () => {}));
});

test('the actual large full mapping is checked with bounded reads and AAB identity', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'healthos-mapping-'));
  const mapping = join(folder, 'mapping.txt'), archive = join(folder, 'R8.tar.gz');
  try {
    const hash = createHash('sha256');
    const header = Buffer.from('# compiler: R8\n# compiler_version: 8.12\n');
    writeFileSync(mapping, header); hash.update(header);
    const chunk = Buffer.from('# native mapping\n'.repeat(4096));
    for (let i = 0; i < 1900; i++) { writeFileSync(mapping, chunk, { flag: 'a' }); hash.update(chunk); }
    writeFileSync(join(folder, 'configuration.txt'), '-keepattributes SourceFile,LineNumberTable\n');
    const tar = process.env.CARESUITE_GITBASH_TAR || 'tar';
    assert.equal(spawnSync(tar, ['--force-local', '-czf', archive, '-C', folder, 'mapping.txt', 'configuration.txt']).status, 0);
    const proof = await verifyR8Archive(archive, hash.digest('hex'));
    assert.ok(proof.mappingBytes > 125000000);
    await assert.rejects(verifyR8Archive(archive, '0'.repeat(64)), /signierten Mapping/);
    writeFileSync(join(folder, 'configuration.txt'), '-dontoptimize\n');
    assert.equal(spawnSync(tar, ['--force-local', '-czf', archive, '-C', folder, 'mapping.txt', 'configuration.txt']).status, 0);
    await assert.rejects(verifyR8Archive(archive), /deaktivieren/);
    assert.equal(spawnSync(tar, ['--force-local', '-czf', archive, '-C', folder, 'mapping.txt']).status, 0);
    await assert.rejects(verifyR8Archive(archive), /configuration.txt.*gefunden: 0/);
  } finally { rmSync(folder, { recursive: true }); }
});

test('compiled AAPT2 manifest fixture matches the existing verified parser', () => {
  const data = Buffer.from('0aaf011a086d616e6966657374222012077061636b6167651a156170702e6361726573756974656865616c74686f7322400a2a687474703a2f2f736368656d61732e616e64726f69642e636f6d2f61706b2f7265732f616e64726f6964120b76657273696f6e4e616d651a05302e342e30223f0a2a687474703a2f2f736368656d61732e616e64726f69642e636f6d2f61706b2f7265732f616e64726f6964120b76657273696f6e436f646532043a023029', 'hex');
  assert.deepEqual(manifestIdentity(data), { applicationId: 'app.caresuitehealthos', versionName: '0.4.0', versionCode: 41 });
  for (const broken of [Buffer.alloc(0), Buffer.from([128]), data.subarray(0, data.length - 1)]) assert.throws(() => manifestIdentity(broken));
});

test('Gradle validates private-key access before expensive native compilation', () => {
  const generated = localSigningInit();
  assert.match(generated, /store.getKey/);
  assert.match(generated, /instanceof PrivateKey/);
  assert.match(generated, /fingerprint != env.CARESUITE_LOCAL_EXPECTED_CERT/);
  assert.match(generated, /privateKeyVerified: true/);
  assert.doesNotMatch(generated, /println.*PASSWORD|println.*KEY_ALIAS/);
});

test('the Windows build uses full production and persistent native outputs', () => {
  const wrapper = readFileSync(new URL('./build-healthos-full-gitbash.sh', import.meta.url), 'utf8');
  const body = readFileSync(new URL('./build-healthos-full-gitbash.mjs', import.meta.url), 'utf8');
  assert.match(wrapper, /EXPO_PUBLIC_APP_EDITION=full/);
  assert.match(wrapper, /EXPO_PUBLIC_DEMO_MODE=false/);
  assert.match(body, /gradlew.bat :app:bundleRelease/);
  assert.doesNotMatch(body, /assembleDebug|keytool.*genkey/);
  assert.match(body, /sdkDownload=false/);
  assert.match(wrapper, /eas env:exec production/);
});
