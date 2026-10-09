import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { sdkSetupPlan, sdkManagerCommand, performSdkSetup, permittedSdkPackages } from './prepare-healthos-local-sdk.mjs';

function fixture(run) {
  const sdk = mkdtempSync(join(tmpdir(), 'healthos SDK with spaces '));
  const file = relative => { const path = join(sdk, relative); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, 'existing fixture'); };
  file('cmake/3.22.1/bin/cmake.exe'); file('cmake/3.22.1/bin/ninja.exe'); file('cmdline-tools/latest/bin/sdkmanager.bat');
  const plan = () => sdkSetupPlan({ sdk, expectedSdk: sdk, java: { home: join(sdk, 'existing JDK'), major: 25 }, windows: true });
  try { run({ sdk, file, plan }); } finally { rmSync(sdk, { recursive: true, force: true }); }
}

test('the setup plan is confined to the three missing packages in the existing SDK', () => fixture(({ plan }) => {
  const p = plan();
  assert.deepEqual(p.missingPackages, permittedSdkPackages);
  assert.equal(p.javaMajor, 25);
  assert.equal(p.canInstallWithExistingTools, true);
  for (const name of ['downloadsJdk', 'installsNewSdkManager', 'changesGlobalEnvironment', 'uninstallsPackages', 'readsSigningCredentials', 'publishesApp']) assert.equal(p[name], false);
  let calls = 0;
  assert.throws(() => performSdkSetup(p, { run: () => { calls++; }, windows: true }), /nicht freigegeben/);
  assert.equal(calls, 0);
}));

test('an authorized setup probes first, installs only missing packages and verifies actual files', () => fixture(({ plan, file }) => {
  file('platforms/android-36/android.jar');
  const p = plan(), commands = [];
  const proof = performSdkSetup(p, { approved: true, windows: true, env: { PATH: 'existing', EXPO_TOKEN: 'secret sentinel', CARESUITE_LOCAL_STORE_PASSWORD: 'private password' }, run: (command, options) => {
    commands.push(command);
    assert.equal(options.env.EXPO_TOKEN, undefined);
    assert.equal(options.env.CARESUITE_LOCAL_STORE_PASSWORD, undefined);
    assert.equal(options.env.JAVA_HOME, p.javaHome);
    if (command.includes('--install')) {
      assert.equal(options.stdio, 'inherit');
      file('build-tools/36.0.0/aapt2.exe');
      for (const name of ['source.properties', 'build/cmake/android.toolchain.cmake', 'toolchains/llvm/prebuilt/windows-x86_64/bin/clang.exe']) file('ndk/27.1.12297006/' + name);
    }
    return { status: 0 };
  } });
  assert.equal(commands.length, 2);
  assert.match(commands[0], /--version$/);
  assert.doesNotMatch(commands[1], /platforms;android-36|--update|--uninstall|--licenses/);
  assert.deepEqual(proof, { installedPackages: ['build-tools;36.0.0', 'ndk;27.1.12297006'], complete: true });
}));

test('an existing incomplete target, different SDK or missing manager prevents installation', () => fixture(({ plan, sdk }) => {
  mkdirSync(join(sdk, 'ndk/27.1.12297006'), { recursive: true });
  assert.equal(plan().canInstallWithExistingTools, false);
  rmSync(join(sdk, 'ndk/27.1.12297006'), { recursive: true });
  assert.equal(sdkSetupPlan({ sdk, expectedSdk: join(sdk, 'other'), java: { home: sdk, major: 25 }, windows: true }).canInstallWithExistingTools, false);
  rmSync(join(sdk, 'cmdline-tools'), { recursive: true });
  assert.equal(plan().canInstallWithExistingTools, false);
}));

test('manager failures, declined licenses and incomplete downloads cannot report success', () => fixture(({ plan }) => {
  const p = plan();
  let calls = 0;
  assert.throws(() => performSdkSetup(p, { approved: true, windows: true, run: () => { calls++; return { status: 2 }; } }), /Keine SDK-Installation/);
  assert.equal(calls, 1);
  assert.throws(() => performSdkSetup(p, { approved: true, windows: true, run: command => ({ status: command.includes('--install') ? 1 : 0 }) }), /abgebrochen/);
  assert.throws(() => performSdkSetup(p, { approved: true, windows: true, run: () => ({ status: 0 }) }), /nicht vollständig/);
}));

test('SDK command construction preserves spaces and refuses arbitrary package or shell arguments', () => fixture(({ plan }) => {
  const p = plan(), command = sdkManagerCommand(p, true);
  assert.match(command, /^".*SDK with spaces .*sdkmanager\.bat" --sdk_root=".*" --install "platforms;android-36" "build-tools;36\.0\.0" "ndk;27\.1\.12297006"$/);
  for (const sdk of ['C:/SDK" & other', 'C:/%VARIABLE%/SDK', 'C:/SDK\nnext']) assert.throws(() => sdkManagerCommand({ ...p, sdk }, true));
  assert.throws(() => sdkManagerCommand({ ...p, missingPackages: ['platform-tools'] }, true));
}));
