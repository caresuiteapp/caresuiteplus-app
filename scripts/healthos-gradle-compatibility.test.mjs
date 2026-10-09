import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkedGradleVersion, lockedGradleVersion, supportsJava, verifyGeneratedGradle } from './healthos-gradle-compatibility.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const wrapper = version => 'distributionUrl=https\\://services.gradle.org/distributions/gradle-' + version + '-bin.zip\n';

test('the actual locked Expo Android template agrees with the JDK 25 runtime policy', () => {
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  assert.equal(lockedGradleVersion(lock), '9.3.1');
  const result = spawnSync(process.env.CARESUITE_GITBASH_TAR || 'tar', ['--force-local', '-xOf', root + 'node_modules/expo/template.tgz', 'package/android/gradle/wrapper/gradle-wrapper.properties'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(verifyGeneratedGradle(result.stdout, checkedGradleVersion, 25), { gradleVersion: '9.3.1', javaMajor: 25 });
  const changed = structuredClone(lock); changed.packages['node_modules/expo'].version = '57.0.21';
  assert.throws(() => lockedGradleVersion(changed));
});

test('an incompatible, unexpected, duplicate or untrusted generated wrapper stops compilation', () => {
  for (const text of [wrapper('8.14.3'), wrapper('9.0.0'), wrapper('9.4.0'), wrapper('9.3.1') + wrapper('9.3.1'), wrapper('9.3.1').replace('services.gradle.org', 'example.com'), '']) {
    assert.throws(() => verifyGeneratedGradle(text, '9.3.1', 25));
  }
  for (const javaMajor of [17, 21, 25]) assert.equal(verifyGeneratedGradle(wrapper('9.3.1'), '9.3.1', javaMajor).javaMajor, javaMajor);
  assert.throws(() => verifyGeneratedGradle(wrapper('9.3.1'), '9.3.1', 26));
  assert.equal(supportsJava(25, '9.1.0'), true);
  assert.equal(supportsJava(25, '8.14.3'), false);
});

test('the actual native build plugins explicitly require compiler toolchain 17', () => {
  for (const path of ['@react-native/gradle-plugin/settings-plugin/build.gradle.kts', '@react-native/gradle-plugin/react-native-gradle-plugin/build.gradle.kts', 'expo-modules-core/android/ExpoModulesCorePlugin.gradle']) {
    assert.match(readFileSync(root + 'node_modules/' + path, 'utf8'), /jvmToolchain\(17\)/);
  }
});
