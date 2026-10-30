#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lockedGradleVersion, verifyGeneratedGradle } from './healthos-gradle-compatibility.mjs';

const require = createRequire(import.meta.url);
if (process.env.GITHUB_ACTIONS !== 'true' || process.platform !== 'linux' || !process.env.RUNNER_TEMP || !/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? '')) {
  throw new Error('Diese Gradle-Konfigurationsprüfung läuft ausschließlich im vorhandenen GitHub-Linux-Workflow.');
}
const sourceRoot = process.cwd();
if (execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== process.env.GITHUB_SHA) throw new Error('Ungeprüfter Quellcommit.');
const stage = mkdtempSync(join(tmpdir(), 'caresuite-agp-preflight-'));
try {
  // Stage committed source without changing the checkout or copying packages.
  execFileSync('bash', ['-o', 'pipefail', '-c', 'git archive "$GITHUB_SHA" | tar -xf - -C "$CARESUITE_AGP_PREFLIGHT_DIR"'], {
    env: { ...process.env, CARESUITE_AGP_PREFLIGHT_DIR: stage }, stdio: 'inherit',
  });
  symlinkSync(join(sourceRoot, 'node_modules'), join(stage, 'node_modules'), 'dir');
  execFileSync(process.execPath, [require.resolve('expo/bin/cli'), 'prebuild', '--platform', 'android', '--no-install'], { cwd: stage, env: process.env, stdio: 'inherit' });
  const android = join(stage, 'android');
  const lock = JSON.parse(readFileSync(join(stage, 'package-lock.json'), 'utf8'));
  verifyGeneratedGradle(readFileSync(join(android, 'gradle/wrapper/gradle-wrapper.properties'), 'utf8'), lockedGradleVersion(lock), 17);
  const proof = join(stage, 'caresuite-toolchain.gradle');
  writeFileSync(proof, `gradle.projectsEvaluated {
    def app = gradle.rootProject.findProject(':app')
    // Init scripts also run in the included React Native/Expo plugin builds.
    // The requested :app:help task still makes a missing main app an error.
    if (app == null) return
    def plugin = app.plugins.findPlugin('com.android.application')
    def version = plugin.class.classLoader.loadClass('com.android.Version').getField('ANDROID_GRADLE_PLUGIN_VERSION').get(null)
    def android = app.extensions.getByName('android')
    if (version != '9.0.1' || android.defaultConfig.minSdk != 24 || android.defaultConfig.targetSdk != 36) {
      throw new GradleException('CareSuite: AGP-/SDK-Konfiguration weicht vom freigegebenen Release ab.')
    }
    println('CareSuite: AGP ' + version + ', minSdk 24 und targetSdk 36 tatsächlich konfiguriert.')
  }\n`);
  execFileSync(join(android, 'gradlew'), ['--no-daemon', '--stacktrace', '--max-workers=1', '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8', '--init-script', proof, ':app:help', ':app:verifyCareSuiteEdgeToEdgeRewrite'], {
    cwd: android, env: { ...process.env, GRADLE_USER_HOME: join(process.env.RUNNER_TEMP, 'caresuite-healthos-gradle') }, stdio: 'inherit',
  });
} finally {
  rmSync(stage, { recursive: true, force: true });
}
