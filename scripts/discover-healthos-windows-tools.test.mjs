import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { discoverJava, discoverSdk, nativeToolPath, requiredSdkPackages, sdkComponents } from './discover-healthos-windows-tools.mjs';

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'healthos existing tools '));
  try { return run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
function file(path) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, 'existing fixture'); }
function jdk(home, tools = ['java', 'javac', 'keytool', 'jarsigner']) { for (const tool of tools) file(join(home, 'bin', tool + '.exe')); }
function javaRunner(versions, pathTools = {}, calls = []) {
  return (command, args) => {
    calls.push({ command, args });
    if (command === 'where.exe') return pathTools[args[0]] ? { status: 0, stdout: pathTools[args[0]].join('\r\n') } : { status: 1, stdout: '' };
    const version = versions[dirname(dirname(command))];
    if (!version) return { status: 1, stderr: 'not found' };
    if (command.endsWith('javac.exe')) return { status: 0, stdout: 'javac ' + (version.compiler || version.java) + '.0.1' };
    return { status: 0, stderr: 'openjdk version "' + version.java + '.0.1" 2026-09-01' };
  };
}
const ndkFiles = ['source.properties', 'build/cmake/android.toolchain.cmake', 'toolchains/llvm/prebuilt/windows-x86_64/bin/clang.exe'];
function sdk(root, components = ['api36', 'buildTools36', 'ndk27', 'cmake322']) {
  if (components.includes('api36')) file(join(root, 'platforms/android-36/android.jar'));
  if (components.includes('buildTools36')) file(join(root, 'build-tools/36.0.0/aapt2.exe'));
  if (components.includes('ndk27')) for (const name of ndkFiles) file(join(root, 'ndk/27.1.12297006', name));
  if (components.includes('cmake322')) for (const name of ['cmake', 'ninja']) file(join(root, 'cmake/3.22.1/bin', name + '.exe'));
}
const notFound = () => ({ status: 1, stdout: '' });

test('Windows paths retain spaces and normalize quoted Git Bash drive paths', () => {
  assert.equal(nativeToolPath('"/c/Program Files/Java/jdk-17"', true), 'C:/Program Files/Java/jdk-17');
  assert.equal(nativeToolPath('/cygdrive/d/SDK with spaces', true), 'D:/SDK with spaces');
  assert.equal(nativeToolPath('C:\\Program Files\\Java\\jdk-17', true), 'C:\\Program Files\\Java\\jdk-17');
  assert.equal(nativeToolPath('/c/unchanged', false), '/c/unchanged');
  for (const value of ['', ' ', null, '/c/java\nsecond', 'C:\\jdk\0']) assert.equal(nativeToolPath(value, true), null);
});

test('a stale JAVA_HOME and PATH runtime do not hide an existing Microsoft JDK', () => fixture(root => {
  const programFiles = join(root, 'Program Files'), home = join(programFiles, 'Microsoft/jdk-17.0.1'), runtime = join(root, 'only runtime');
  jdk(home); jdk(runtime, ['java', 'keytool']);
  const result = discoverJava({ windows: true, env: { ProgramFiles: programFiles, JAVA_HOME: join(root, 'old missing JDK') }, run: javaRunner({ [home]: { java: 17 }, [runtime]: { java: 21 } }, { 'java.exe': [join(runtime, 'bin/java.exe')] }) });
  assert.deepEqual(result.selected, { home, major: 17 });
  assert.equal(result.candidates.find(candidate => candidate.home === runtime).supported, false);
  assert.ok(result.candidates.find(candidate => candidate.home === runtime).missingTools.includes('jarsigner'));
}));

test('an existing Android Studio JBR is found without JAVA_HOME or PATH java', () => fixture(root => {
  const home = join(root, 'Programs/Android Studio/jbr'); jdk(home);
  const result = discoverJava({ windows: true, env: { LOCALAPPDATA: root }, run: javaRunner({ [home]: { java: 21 } }) });
  assert.deepEqual(result.selected, { home, major: 21 });
}));

test('the installed Android Studio JDK 25 is usable with the verified Gradle 9.3.1 release', () => fixture(root => {
  const home = join(root, 'Programs/Android Studio/jbr'); jdk(home);
  const options = { windows: true, env: { LOCALAPPDATA: root }, run: javaRunner({ [home]: { java: 25 } }) };
  assert.deepEqual(discoverJava({ ...options, gradleVersion: '9.3.1' }).selected, { home, major: 25 });
  assert.equal(discoverJava({ ...options, gradleVersion: '9.3.1' }).compiler, null);
  for (const gradleVersion of [undefined, '8.14.3', '9.0.0', 'invalid']) assert.equal(discoverJava({ ...options, gradleVersion }).selected, null);
  assert.equal(discoverJava({ ...options, gradleVersion: '9.3.1', run: javaRunner({ [home]: { java: 25, compiler: 21 } }) }).selected, null);
}));

test('Gradle runtime and the mandatory native compiler JDK 17 are discovered separately', () => fixture(root => {
  const runtime = join(root, 'runtime25'), compiler = join(root, '.jdks/compiler17'); jdk(runtime); jdk(compiler);
  const result = discoverJava({ windows: true, env: { JAVA_HOME: runtime, USERPROFILE: root }, gradleVersion: '9.3.1', run: javaRunner({ [runtime]: { java: 25 }, [compiler]: { java: 17 } }) });
  assert.deepEqual(result.selected, { home: runtime, major: 25 });
  assert.deepEqual(result.compiler, { home: compiler, major: 17 });
}));

test('an already cached native compiler in the managed Gradle home is reused', () => fixture(root => {
  const runtime = join(root, 'runtime25'), compiler = join(root, '.healthos-gitbash/gradle/jdks/existing17/home'); jdk(runtime); jdk(compiler);
  const result = discoverJava({ projectRoot: root, windows: true, env: { JAVA_HOME: runtime }, gradleVersion: '9.3.1', run: javaRunner({ [runtime]: { java: 25 }, [compiler]: { java: 17 } }) });
  assert.deepEqual(result.compiler, { home: compiler, major: 17 });
}));

test('existing user JDK caches are considered and unsupported Java is reported', () => fixture(root => {
  const unsupported = join(root, '.jdks/jdk-25'), home = join(root, '.gradle/jdks/temurin-17/jdk-17'); jdk(home); jdk(unsupported);
  const result = discoverJava({ windows: true, env: { USERPROFILE: root }, run: javaRunner({ [home]: { java: 17 }, [unsupported]: { java: 25 } }) });
  assert.deepEqual(result.selected, { home, major: 17 });
  assert.equal(result.candidates.find(candidate => candidate.home === unsupported).major, 25);
  assert.equal(result.candidates.find(candidate => candidate.home === unsupported).supported, false);
}));

test('a large unrelated vendor directory cannot exhaust the search for a later existing user JDK', () => fixture(root => {
  const programs = join(root, 'Program Files');
  for (let parent = 0; parent < 64; parent++) for (let child = 0; child < 12; child++) mkdirSync(join(programs, 'Microsoft', 'unrelated-' + parent, 'entry-' + child), { recursive: true });
  const home = join(root, 'user/.jdks/temurin-17'); jdk(home);
  const result = discoverJava({ windows: true, env: { ProgramFiles: programs, USERPROFILE: join(root, 'user') }, run: javaRunner({ [home]: { java: 17 } }) });
  assert.deepEqual(result.selected, { home, major: 17 });
}));

test('an explicitly selected complete JDK 21 is retained and mixed tools are refused', () => fixture(root => {
  const explicit = join(root, 'selected'), automatic = join(root, 'Program Files/Java/jdk-17'); jdk(explicit); jdk(automatic);
  const env = { JAVA_HOME: '"' + explicit + '"', ProgramFiles: join(root, 'Program Files') };
  assert.deepEqual(discoverJava({ windows: true, env, run: javaRunner({ [explicit]: { java: 21 }, [automatic]: { java: 17 } }) }).selected, { home: explicit, major: 21 });
  const broken = discoverJava({ windows: true, env, run: javaRunner({ [explicit]: { java: 21, compiler: 17 }, [automatic]: { java: 17 } }) });
  assert.deepEqual(broken.selected, { home: automatic, major: 17 });
  assert.match(broken.candidates.find(candidate => candidate.home === explicit).reason, /unterschiedliche/);
}));

test('a failed or hung version probe is not mistaken for an installed compiler', () => fixture(root => {
  const home = join(root, 'JDK'); jdk(home);
  const result = discoverJava({ windows: true, env: { JAVA_HOME: home }, run: (command, args, options) => {
    assert.equal(options.timeout, 10000);
    if (command === 'where.exe') return notFound();
    throw new Error('private error detail must not be reported');
  } });
  assert.equal(result.selected, null);
  assert.doesNotMatch(JSON.stringify(result), /private error detail/);
}));

test('a complete SDK is selected ahead of a stale SDK that only has CMake', () => fixture(root => {
  const stale = join(root, 'old SDK'), complete = join(root, 'Android/Sdk'); sdk(stale, ['cmake322']); sdk(complete);
  const result = discoverSdk({ windows: true, env: { ANDROID_HOME: stale, LOCALAPPDATA: root }, run: notFound });
  assert.equal(result.selected.sdk, complete);
  assert.equal(result.selected.complete, true);
  assert.deepEqual(result.selected.missingPackages, []);
  assert.equal(result.candidates.find(candidate => candidate.sdk === stale).complete, false);
}));

test('an incomplete SDK reports exact required package ids and installed alternatives', () => fixture(root => {
  const home = join(root, 'SDK'); sdk(home, ['cmake322']);
  file(join(home, 'platforms/android-35/android.jar')); file(join(home, 'build-tools/35.0.0/aapt2.exe')); file(join(home, 'ndk/28.2.13676358/source.properties'));
  const result = discoverSdk({ windows: true, env: { ANDROID_SDK_ROOT: home }, run: notFound });
  assert.deepEqual(result.selected.missingPackages, ['platforms;android-36', 'build-tools;36.0.0', 'ndk;27.1.12297006']);
  assert.deepEqual(result.selected.installedVersions.ndk, ['28.2.13676358']);
  assert.equal(result.selected.components.ndk27, false);
}));

test('a partial NDK directory or CMake without Ninja cannot pass the build gate', () => fixture(root => {
  sdk(root); rmSync(join(root, 'ndk/27.1.12297006/toolchains/llvm/prebuilt/windows-x86_64/bin/clang.exe'));
  rmSync(join(root, 'cmake/3.22.1/bin/ninja.exe'));
  assert.deepEqual(sdkComponents(root, true), { api36: true, buildTools36: true, ndk27: false, cmake322: false });
}));

test('an SDK configured by existing local.properties is detected without environment setup', () => fixture(root => {
  const home = join(root, 'SDK with spaces'), project = join(root, 'project'); sdk(home);
  mkdirSync(join(project, 'android'), { recursive: true });
  writeFileSync(join(project, 'android/local.properties'), 'sdk.dir=' + home.replaceAll(' ', '\\ ') + '\n');
  const result = discoverSdk({ windows: true, env: {}, projectRoot: project, run: notFound });
  assert.equal(result.selected.sdk, home);
  assert.equal(result.selected.complete, true);
}));

test('PATH SDK manager detection works for current and legacy SDK layouts', () => fixture(root => {
  const home = join(root, 'existing SDK'); sdk(home);
  for (const layout of ['cmdline-tools/latest/bin/sdkmanager.bat', 'tools/bin/sdkmanager.bat']) {
    file(join(home, layout));
    const run = (command, args) => command === 'where.exe' && args[0] === 'sdkmanager.bat' ? { status: 0, stdout: join(home, layout) + '\r\n' } : notFound();
    assert.equal(discoverSdk({ windows: true, env: {}, run }).selected.sdk, home);
  }
}));

test('tool diagnostics never contain tokens, signing passwords, or credential contents', () => fixture(root => {
  const home = join(root, 'JDK'), sdkHome = join(root, 'SDK'), calls = []; jdk(home); sdk(sdkHome);
  const env = { JAVA_HOME: home, ANDROID_HOME: sdkHome, EXPO_TOKEN: 'private-token-sentinel', CARESUITE_LOCAL_STORE_PASSWORD: 'private-password-sentinel' };
  writeFileSync(join(root, 'credentials.json'), 'private-credentials-sentinel');
  const run = javaRunner({ [home]: { java: 17 } }, {}, calls);
  const result = { java: discoverJava({ windows: true, env, run, projectRoot: root }), sdk: discoverSdk({ windows: true, env, run, projectRoot: root }) };
  assert.doesNotMatch(JSON.stringify(result), /private-(?:token|password|credentials)-sentinel/);
  assert.ok(calls.every(call => call.command === 'where.exe' || /(?:java|javac)\.exe$/.test(call.command)));
  assert.equal(requiredSdkPackages.ndk27, 'ndk;27.1.12297006');
}));

test('a failed preflight stops the Git Bash wrapper before EAS, credentials, and package loading', () => fixture(root => {
  if (process.platform === 'win32') return; // POSIX shims exercise the actual Bash wrapper on this host.
  const bin = join(root, 'bin'), trace = join(root, 'commands.txt'); mkdirSync(bin);
  for (const name of ['node', 'eas', 'npm']) {
    writeFileSync(join(bin, name), '#!/usr/bin/env bash\nprintf "%s\\n" "' + name + ' $*" >> "$CARESUITE_PREFLIGHT_TEST_TRACE"\nexit 19\n', { mode: 0o755 });
  }
  const wrapper = fileURLToPath(new URL('./build-healthos-full-gitbash.sh', import.meta.url));
  const result = spawnSync('bash', [wrapper], { encoding: 'utf8', env: { ...process.env, PATH: bin + ':' + process.env.PATH, CARESUITE_PREFLIGHT_TEST_TRACE: trace } });
  assert.equal(result.status, 19);
  assert.equal(readFileSync(trace, 'utf8').trim(), 'node scripts/build-healthos-full-gitbash.mjs --preflight');
}));
