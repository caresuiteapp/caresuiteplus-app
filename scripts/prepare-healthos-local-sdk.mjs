#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, delimiter } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { discoverJava, discoverSdk, sdkComponents, requiredSdkPackages } from './discover-healthos-windows-tools.mjs';
import { lockedGradleVersion } from './healthos-gradle-compatibility.mjs';
import { prepareCompilerJdk17 } from './prepare-healthos-compiler-jdk.mjs';

export const permittedSdkPackages = Object.freeze(['platforms;android-36', 'build-tools;36.0.0', 'ndk;27.1.12297006']);

function shellArgument(value) {
  if (typeof value !== 'string' || !value || /["%!*&|<>^\r\n\0]/.test(value)) throw new Error('Ein Werkzeugpfad enthält für den Windows-Aufruf nicht freigegebene Sonderzeichen.');
  return '"' + value + '"';
}

export function sdkManagerCommand(plan, install = false) {
  if (!plan.sdkManager || plan.missingPackages.some(value => !permittedSdkPackages.includes(value))) throw new Error('SDK-Manager oder Paketumfang nicht bestätigt.');
  return shellArgument(plan.sdkManager) + ' --sdk_root=' + shellArgument(plan.sdk) +
    (install ? ' --install ' + plan.missingPackages.map(shellArgument).join(' ') : ' --version');
}

export function sdkSetupPlan({ sdk, java, expectedSdk, windows = process.platform === 'win32' }) {
  const components = sdkComponents(sdk, windows);
  const missingPackages = Object.keys(requiredSdkPackages).filter(key => key !== 'cmake322' && !components[key]).map(key => requiredSdkPackages[key]);
  let versions = [];
  try { versions = readdirSync(join(sdk, 'cmdline-tools'), { withFileTypes: true }).filter(value => value.isDirectory()).map(value => value.name).sort().reverse().slice(0, 32); } catch {}
  const sdkManager = ['latest', ...versions].map(version => join(sdk, 'cmdline-tools', version, 'bin', 'sdkmanager.bat')).find(existsSync) || null;
  const partialTargets = missingPackages.filter(value => existsSync(join(sdk, ...value.split(';'))));
  const sameSdk = resolve(sdk).toLowerCase() === resolve(expectedSdk).toLowerCase();
  const blocked = !windows ? 'Die Einrichtung ist ausschließlich für den vorhandenen Windows-Laptop vorgesehen.' :
    !sameSdk ? 'Der ausgewählte SDK-Pfad weicht vom bestätigten bestehenden Benutzer-SDK ab.' :
    !java ? 'Kein vollständiges, mit dem Release kompatibles vorhandenes JDK gefunden.' :
    !components.cmake322 ? 'Das bisher bestätigte CMake 3.22.1 mit Ninja fehlt; den Umfang erneut abgleichen.' :
    partialTargets.length ? 'Ein fehlendes Paket besitzt bereits einen unvollständigen Zielordner. Eigene oder teilweise installierte Dateien werden nicht überschrieben.' :
    missingPackages.length && !sdkManager ? 'Im vorhandenen Android-SDK wurde kein sdkmanager.bat gefunden. Es wird kein zusätzliches Werkzeug heruntergeladen.' : null;
  const plan = { sdk, sdkManager, javaHome: java?.home || null, javaMajor: java?.major || null, components, missingPackages,
    canInstallWithExistingTools: !blocked, blockedReason: blocked, partialTargets,
    downloadsJdk: false, installsNewSdkManager: false, changesGlobalEnvironment: false, uninstallsPackages: false,
    readsSigningCredentials: false, publishesApp: false };
  if (plan.canInstallWithExistingTools && plan.sdkManager) sdkManagerCommand(plan);
  return plan;
}

export function performSdkSetup(plan, { approved = false, run = spawnSync, env = process.env, windows = process.platform === 'win32' } = {}) {
  if (!approved) throw new Error('SDK-Ergänzung nicht freigegeben. --plan verändert keine installierten Werkzeuge.');
  if (!windows || !plan.canInstallWithExistingTools) throw new Error(plan.blockedReason || 'Vorhandene Windows-Werkzeuge nicht bestätigt.');
  if (!plan.missingPackages.length) return { installedPackages: [], complete: true };
  const command = sdkManagerCommand(plan, true);
  const childEnv = {};
  for (const name of ['SystemRoot', 'SYSTEMROOT', 'windir', 'WINDIR', 'ComSpec', 'COMSPEC', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'ProgramFiles', 'ProgramFiles(x86)', 'PATHEXT']) if (env[name]) childEnv[name] = env[name];
  childEnv.PATH = join(plan.javaHome, 'bin') + delimiter + (env.PATH || '');
  childEnv.JAVA_HOME = plan.javaHome;
  childEnv.ANDROID_HOME = plan.sdk;
  childEnv.ANDROID_SDK_ROOT = plan.sdk;
  const probe = run(sdkManagerCommand(plan), { shell: true, env: childEnv, encoding: 'utf8', timeout: 15000, windowsHide: true });
  if (probe.error || probe.status !== 0) throw new Error('Der vorhandene SDK-Manager konnte mit dem vorhandenen JDK nicht gestartet werden. Keine SDK-Installation gestartet.');
  // Licenses remain interactive. Never accept them through an automatic yes pipe.
  const result = run(command, { shell: true, env: childEnv, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('SDK-Ergänzung abgebrochen oder fehlgeschlagen. Den Abschluss nicht als erfolgreichen Build behandeln.');
  if (Object.values(sdkComponents(plan.sdk, windows)).some(value => !value)) throw new Error('Die drei SDK-Pakete wurden nach dem Vorgang nicht vollständig bestätigt.');
  return { installedPackages: plan.missingPackages, complete: true };
}

async function main() {
  const mode = process.argv[2];
  if (process.argv.length !== 3 || !['--plan', '--setup-build-tools'].includes(mode)) throw new Error('Aufruf: node scripts/prepare-healthos-local-sdk.mjs --plan|--setup-build-tools');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (process.platform !== 'win32') throw new Error('Dieses Skript ist ausschließlich für Windows / Git Bash vorgesehen.');
  const status = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
  if (status.error || status.status !== 0 || status.stdout.trim()) throw new Error('Der Releaseordner enthält eigene Änderungen; sie bleiben erhalten.');
  if (!process.env.LOCALAPPDATA) throw new Error('Der vorhandene Benutzer-SDK-Pfad konnte nicht bestätigt werden.');
  const expectedGradleVersion = lockedGradleVersion(JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')));
  const javaDiscovery = discoverJava({ projectRoot: root, gradleVersion: expectedGradleVersion });
  const java = javaDiscovery.selected;
  const sdk = discoverSdk({ projectRoot: root }).selected?.sdk;
  if (!sdk) throw new Error('Kein bestehendes Android-SDK gefunden. Es wird keine neue SDK-Umgebung eingerichtet.');
  const plan = sdkSetupPlan({ sdk, java, expectedSdk: join(process.env.LOCALAPPDATA, 'Android', 'Sdk') });
  const compilerHome = javaDiscovery.compiler?.home || null;
  const completePlan = { ...plan, downloadsJdk: !compilerHome, setupApproved: mode === '--setup-build-tools', expectedGradleVersion, compilerJdk: 17, javaCompilerHome: compilerHome, requiresPortableJdk17: !compilerHome, jdkProvider: !compilerHome ? 'Eclipse Temurin, offizielles JDK-17-Windows-x64-ZIP mit SHA-256-Prüfung' : null };
  console.log(JSON.stringify(completePlan, null, 2));
  const state = join(root, '.healthos-gitbash');
  mkdirSync(state, { recursive: true });
  writeFileSync(join(state, 'SDK-SETUP-PLAN.json'), JSON.stringify(completePlan, null, 2) + '\n');
  if (mode === '--plan') return;
  if (!plan.canInstallWithExistingTools) throw new Error(plan.blockedReason);
  const compilerProof = await prepareCompilerJdk17({ compilerHome, userProfile: process.env.USERPROFILE, state, unzip: process.env.CARESUITE_GITBASH_UNZIP || 'unzip' }, { approved: true });
  writeFileSync(join(state, 'COMPILER-JDK-VERIFIED.json'), JSON.stringify(compilerProof, null, 2) + '\n');
  const proof = performSdkSetup(plan, { approved: true });
  writeFileSync(join(state, 'SDK-SETUP-VERIFIED.json'), JSON.stringify({ ...proof, sdk, javaMajor: java.major, compilerHome: compilerProof.compilerHome, expectedGradleVersion }, null, 2) + '\n');
  console.log('Die vorgesehenen Android-SDK-Komponenten sind vollständig bestätigt.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error('ABBRUCH: ' + error.message); process.exitCode = 1; });
}
