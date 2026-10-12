#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, symlinkSync } from 'node:fs';
import { join, resolve, dirname, delimiter, isAbsolute } from 'node:path';
import { totalmem } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { memoryPlan, writeMemoryConfiguration, verifyMemoryProof } from './configure-healthos-gradle-memory.mjs';
import { publicCommand, verifyLocalAab } from './verify-local-healthos-aab.mjs';
import { discoverJava, discoverSdk, sdkComponents, requiredSdkPackages } from './discover-healthos-windows-tools.mjs';
import { lockedGradleVersion, verifyGeneratedGradle } from './healthos-gradle-compatibility.mjs';
export { sdkComponents };

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const state = join(root, '.healthos-gitbash');
const MIB = 1024 * 1024;
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const nativePath = value => process.platform === 'win32' && /^\/[a-z]\//i.test(value) ? value[1].toUpperCase() + ':' + value.slice(2) : value;
const commandOptions = extra => ({ cwd: root, encoding: 'utf8', ...extra });

function fixedCommand(command, { cwd = root, env = process.env, capture = false } = {}) {
  // Commands are fixed by this script; neither passwords nor user paths are
  // interpolated into a shell command. Windows .cmd/.bat files require a shell.
  const result = spawnSync(command, { cwd, env, shell: true, encoding: 'utf8', maxBuffer: 4 * MIB, stdio: capture ? 'pipe' : 'inherit' });
  if (result.status !== 0 || result.error) throw new Error('Buildschritt fehlgeschlagen.');
  return result.stdout;
}

function commit() {
  const value = publicCommand('git', ['rev-parse', 'HEAD'], commandOptions()).trim();
  if (!/^[a-f0-9]{40}$/.test(value)) throw new Error('Ungültiger Quellcommit.');
  return value;
}

function cleanSource() {
  if (publicCommand('git', ['status', '--porcelain=v1', '--untracked-files=all'], commandOptions()).trim()) throw new Error('Der native Releaseordner enthält lokale Änderungen. Sie werden nicht überschrieben.');
  const origins = publicCommand('git', ['remote', 'get-url', '--all', 'origin'], commandOptions()).trim().split(/\r?\n/);
  if (origins.length !== 1 || !/^(?:https:\/\/github\.com\/caresuiteapp\/caresuiteplus-app(?:\.git)?|git@github\.com:caresuiteapp\/caresuiteplus-app\.git)$/.test(origins[0])) throw new Error('Falsches CareSuite-Repository.');
}

export function parseCredentials(data, credentialFile) {
  const k = data?.android?.keystore;
  if (!k || ['keystorePath', 'keystorePassword', 'keyAlias', 'keyPassword'].some(name => typeof k[name] !== 'string' || !k[name].length)) throw new Error('credentials.json enthält keine vollständige vorhandene Android-Signierung.');
  return {
    file: isAbsolute(k.keystorePath) ? k.keystorePath : resolve(dirname(credentialFile), k.keystorePath),
    storePassword: k.keystorePassword, keyAlias: k.keyAlias, keyPassword: k.keyPassword,
  };
}

function credentialFile() {
  return resolve(root, nativePath(process.env.CARESUITE_CREDENTIALS_FILE || 'credentials.json'));
}

function toolWorks(name, args, batch = false) {
  const options = commandOptions();
  const r = batch && process.platform === 'win32' ? spawnSync(name + ' ' + args.join(' '), { ...options, shell: true }) : spawnSync(name, args, options);
  return !r.error && r.status === 0;
}

export function sameDependencies(before, after) {
  const stable = value => JSON.stringify(Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b)));
  return ['dependencies', 'devDependencies'].every(name => stable(before[name]) === stable(after[name]));
}

export function installedPackagesMatch(folder, lock) {
  const declared = { ...lock.packages?.['']?.dependencies, ...lock.packages?.['']?.devDependencies };
  if (!Object.keys(declared).length) return false;
  return Object.keys(declared).every(name => {
    try { return json(join(folder, 'node_modules', name, 'package.json')).version === lock.packages['node_modules/' + name]?.version; }
    catch { return false; }
  });
}

function preparePackages() {
  const lockFile = join(root, 'package-lock.json');
  const proofFile = join(state, 'DEPENDENCIES.json');
  const lockHash = sha256(readFileSync(lockFile));
  const previous = existsSync(proofFile) ? json(proofFile) : null;
  if (previous?.lockSha256 !== lockHash || !installedPackagesMatch(root, json(lockFile))) {
    console.log('Gesicherte Projektpakete aus package-lock.json laden.');
    fixedCommand('npm ci');
  }
  if (!installedPackagesMatch(root, json(lockFile))) throw new Error('Installierte Projektpakete stimmen nicht mit dem Release-Lockfile überein.');
  writeJson(proofFile, { lockSha256: lockHash, commit: commit() });
}

function preflight() {
  mkdirSync(state, { recursive: true });
  cleanSource();
  const missing = [];
  if (process.platform !== 'win32') missing.push('Windows / Git Bash auf dem Windows-Laptop');
  const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
  if (nodeMajor < 20 || (nodeMajor === 20 && nodeMinor < 19)) missing.push('Node.js mindestens 20.19');
  for (const [name, args, batch] of [['git', ['--version'], false], ['npm', ['--version'], true], ['eas', ['--version'], true], [process.env.CARESUITE_GITBASH_UNZIP || 'unzip', ['-v'], false], ['bash', ['--version'], false]]) {
    if (!toolWorks(name, args, batch)) missing.push(name);
  }
  const tarCheck = spawnSync(process.env.CARESUITE_GITBASH_TAR || 'tar', ['--version'], commandOptions());
  if (tarCheck.error || tarCheck.status !== 0 || !/GNU tar/.test(tarCheck.stdout)) missing.push('GNU tar aus der vorhandenen Git-Bash-Shell');
  const expectedGradleVersion = lockedGradleVersion(json(join(root, 'package-lock.json')));
  const javaDiscovery = discoverJava({ projectRoot: root, gradleVersion: expectedGradleVersion }), java = javaDiscovery.selected;
  if (!java) missing.push('Vorhandenes vollständiges JDK 17, 21 oder mit Gradle 9.3.1 kompatibles JDK 25 (java, javac, keytool, jarsigner)');
  const compiler = javaDiscovery.compiler;
  if (!compiler) missing.push('Vollständige JDK-17-Compiler-Toolchain für React Native und Expo (jvmToolchain(17))');
  const sdkDiscovery = discoverSdk({ projectRoot: root }), sdk = sdkDiscovery.selected?.sdk || '';
  const components = sdk ? sdkDiscovery.selected.components : { api36: false, buildTools36: false, ndk27: false, cmake322: false };
  for (const [name, value] of Object.entries(components)) if (!value) missing.push('Android SDK: ' + requiredSdkPackages[name]);
  let plan;
  try { plan = memoryPlan(Math.floor(totalmem() / MIB)); } catch (error) { missing.push(error.message); }
  const javaCandidates = javaDiscovery.candidates.map(value => value.exists ? value : { home: value.home, source: value.source, exists: false });
  const sdkCandidates = sdkDiscovery.candidates.map(value => value.exists ? value : { sdk: value.sdk, source: value.source, exists: false });
  const info = { ready: missing.length === 0, host: process.platform, node: process.version, jdk: java?.major || null, javaHome: java?.home || null, compilerJdk: compiler?.major || null, javaCompilerHome: compiler?.home || null, expectedGradleVersion, sdk: sdk || null, sdkComponents: components, javaSearchRoots: javaDiscovery.searchRoots, javaCandidates, sdkCandidates, memoryMiB: Math.floor(totalmem() / MIB), compilerHeapMiB: plan?.heapMiB || null, existingCredentialsFile: existsSync(credentialFile()), missing, commit: commit() };
  writeJson(join(state, 'PREFLIGHT.json'), info);
  console.log(JSON.stringify(info, null, 2));
  if (missing.length) throw new Error('Lokaler Build noch nicht möglich: Die oben genannten Werkzeuge wurden nicht vollständig bestätigt. Suchpfade und vorhandene Versionen stehen in PREFLIGHT.json. Es wurde keine Software eingerichtet und keine EAS-Version geändert.');
  writeJson(join(state, 'TOOLS.json'), { javaHome: java.home, javaMajor: java.major, javaCompilerHome: compiler.home, expectedGradleVersion, sdk: resolve(sdk), plan, commit: info.commit });
}

function toolEnv(tools) {
  return {
    ...process.env, JAVA_HOME: tools.javaHome, ANDROID_HOME: tools.sdk, ANDROID_SDK_ROOT: tools.sdk,
    PATH: join(tools.javaHome, 'bin') + delimiter + process.env.PATH,
    APP_ENV: 'production', EXPO_PUBLIC_APP_EDITION: 'full', EXPO_PUBLIC_DEMO_MODE: 'false',
    EXPO_PUBLIC_FOLDER: 'public-portal', EXPO_NO_TELEMETRY: '1', CI: 'true',
    EAS_BUILD_GIT_COMMIT_HASH: tools.commit,
    NODE_OPTIONS: '--max-old-space-size=' + (tools.plan.effectiveMemoryMiB >= 12288 ? 6144 : 5120),
  };
}

function checkedCredentials(tools) {
  const file = credentialFile(), values = parseCredentials(json(file), file);
  if (!existsSync(values.file)) throw new Error('Der bestehende Upload-Keystore fehlt am in credentials.json angegebenen Ort.');
  const env = { ...toolEnv(tools), CARESUITE_LOCAL_STORE_PASSWORD: values.storePassword };
  const cert = spawnSync(join(tools.javaHome, 'bin', 'keytool' + (process.platform === 'win32' ? '.exe' : '')), ['-exportcert', '-keystore', values.file, '-alias', values.keyAlias, '-storepass:env', 'CARESUITE_LOCAL_STORE_PASSWORD'], { cwd: root, env, maxBuffer: MIB });
  if (cert.error || cert.status !== 0 || !cert.stdout?.length) throw new Error('Der vorhandene Upload-Keystore konnte mit den lokalen Zugangsdaten nicht geöffnet werden.');
  const fingerprint = sha256(cert.stdout).toUpperCase().match(/../g).join(':');
  const expected = json(join(root, 'docs/store/android-signing-identity.json'));
  if (fingerprint !== expected.uploadCertificateSha256) throw new Error('Lokaler Keystore passt nicht zum bestätigten Play-Uploadzertifikat. Es wird kein Ersatzschlüssel erzeugt.');
  writeJson(join(state, 'UPLOAD-CERTIFIED.json'), { commit: tools.commit, uploadCertificateSha256: fingerprint });
  console.log('Bestehendes Uploadzertifikat bestätigt: ' + fingerprint);
  return values;
}

export function versionPlan(remote, sourceCommit) {
  const baseline = Number(remote.versionCode);
  if (!Number.isSafeInteger(baseline) || baseline < 40 || baseline >= 2100000000 || !/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error('Ungültige EAS-Versionsbasis oder Quellidentität.');
  return { commit: sourceCommit, baseline, versionCode: baseline + 1 };
}

export function signingGradle(code) {
  if (!Number.isSafeInteger(code) || code <= 40 || code > 2100000000) throw new Error('Ungültiger Release-Code.');
  return '\n// CareSuite verified local release signing\nandroid {\n    defaultConfig { versionCode ' + code + ' }\n    signingConfigs {\n        release {\n            storeFile file(System.getenv("CARESUITE_LOCAL_STORE_FILE"))\n            storePassword System.getenv("CARESUITE_LOCAL_STORE_PASSWORD")\n            keyAlias System.getenv("CARESUITE_LOCAL_KEY_ALIAS")\n            keyPassword System.getenv("CARESUITE_LOCAL_KEY_PASSWORD")\n        }\n    }\n    buildTypes { release { signingConfig signingConfigs.release } }\n}\n';
}

export function localSigningInit() {
  return [
    'import java.security.KeyStore',
    'import java.security.PrivateKey',
    'import java.security.MessageDigest',
    'import groovy.json.JsonOutput',
    'def env = System.getenv()',
    'try {',
    '    def store = KeyStore.getInstance(new File(env.CARESUITE_LOCAL_STORE_FILE), env.CARESUITE_LOCAL_STORE_PASSWORD.toCharArray())',
    '    def key = store.getKey(env.CARESUITE_LOCAL_KEY_ALIAS, env.CARESUITE_LOCAL_KEY_PASSWORD.toCharArray())',
    "    if (!(key instanceof PrivateKey)) throw new Exception('missing private key')",
    "    def digest = MessageDigest.getInstance('SHA-256').digest(store.getCertificate(env.CARESUITE_LOCAL_KEY_ALIAS).encoded)",
    "    def fingerprint = digest.collect { String.format('%02X', it & 255) }.join(':')",
    "    if (fingerprint != env.CARESUITE_LOCAL_EXPECTED_CERT) throw new Exception('wrong certificate')",
    '    def proof = [commit: env.EAS_BUILD_GIT_COMMIT_HASH, uploadCertificateSha256: fingerprint, privateKeyVerified: true]',
    "    new File(env.CARESUITE_LOCAL_UPLOAD_PROOF).text = JsonOutput.prettyPrint(JsonOutput.toJson(proof)) + '\\n'",
    "    println('CareSuite: vorhandener privater Uploadschlüssel und beide Passwörter vor der Kompilierung geprüft.')",
    '} catch (Exception ignored) {',
    "    throw new GradleException('CareSuite: vorhandener Uploadschlüssel oder lokale Passwörter nicht bestätigt; Kompilierung abgebrochen.')",
    '}',
    '',
  ].join('\n');
}

export function checkReserved(plan, remote, sourceCommit) {
  if (plan.commit !== sourceCommit || plan.versionCode !== plan.baseline + 1 || Number(remote.versionCode) !== plan.versionCode || !Number.isInteger(plan.baseline) || plan.baseline < 40) throw new Error('EAS-Versionsreservierung stimmt nicht mit dem geprüften lokalen Build überein.');
}

async function build() {
  const tools = json(join(state, 'TOOLS.json')), version = json(join(state, 'VERSION-RESERVED.json'));
  cleanSource();
  if (commit() !== tools.commit) throw new Error('Quellstand wurde nach der Werkzeugprüfung verändert.');
  checkReserved(version, { versionCode: version.versionCode }, tools.commit);
  const credentials = checkedCredentials(tools), env = toolEnv(tools);
  const source = join(state, 'source'), marker = join(state, 'SOURCE.json');
  if (!existsSync(source)) {
    publicCommand('git', ['worktree', 'add', '--detach', source, tools.commit], commandOptions());
    writeJson(marker, { commit: tools.commit });
  } else if (!existsSync(marker) || json(marker).commit !== tools.commit || publicCommand('git', ['rev-parse', 'HEAD'], { cwd: source }).trim() !== tools.commit) throw new Error('Vorhandener lokaler Buildordner gehört zu einem anderen Quellstand.');
  if (publicCommand('git', ['status', '--porcelain=v1', '--untracked-files=no'], { cwd: source }).trim()) throw new Error('Im lokalen Build-Worktree liegen veränderte Quelltexte. Sie werden nicht überschrieben.');
  if (!existsSync(join(source, 'node_modules'))) symlinkSync(join(root, 'node_modules'), join(source, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  console.log('Vollständige native App und aktuellen Android-Export prüfen.');
  const checks = spawnSync('bash', ['scripts/check-healthos-full-release.sh'], { cwd: source, env, stdio: 'inherit' });
  if (checks.status !== 0) throw new Error('Vollständige native App-Prüfung fehlgeschlagen.');
  const packageBefore = readFileSync(join(source, 'package.json'));
  if (!existsSync(join(source, 'android', 'gradlew.bat'))) {
    try {
      const prebuild = spawnSync(process.execPath, ['node_modules/expo/bin/cli', 'prebuild', '--platform', 'android', '--no-install', '--skip-dependency-update', 'react,react-native'], { cwd: source, env, stdio: 'inherit' });
      if (prebuild.status !== 0) throw new Error('Natives Android-Projekt konnte nicht erzeugt werden.');
      if (!sameDependencies(JSON.parse(packageBefore), json(join(source, 'package.json')))) throw new Error('Prebuild hat Paketversionen verändert; Build abgebrochen.');
    } finally { writeFileSync(join(source, 'package.json'), packageBefore); }
  }
  const expectedGradleVersion = lockedGradleVersion(json(join(source, 'package-lock.json')));
  if (tools.expectedGradleVersion !== expectedGradleVersion) throw new Error('Gradle-Vorgaben wurden nach der Vorprüfung verändert. Die Vorprüfung erneut ausführen.');
  const gradleRuntime = verifyGeneratedGradle(readFileSync(join(source, 'android', 'gradle', 'wrapper', 'gradle-wrapper.properties'), 'utf8'), expectedGradleVersion, tools.javaMajor);
  writeJson(join(state, 'GRADLE-RUNTIME.json'), { ...gradleRuntime, commit: tools.commit });
  const output = join(state, 'release');
  mkdirSync(output, { recursive: true });
  const memoryFile = join(output, 'BUILD-MEMORY.json'), gradleHome = join(state, 'gradle');
  writeMemoryConfiguration(gradleHome, memoryFile, tools.plan, tools.commit);
  writeFileSync(join(gradleHome, 'init.d', 'caresuite-healthos-local-signing.gradle'), localSigningInit());
  // Components were checked above; Gradle must not install an SDK/NDK setup.
  if (!tools.javaCompilerHome || /[,\r\n\0]/.test(tools.javaCompilerHome)) throw new Error('Die bestätigte JDK-17-Compiler-Toolchain fehlt oder besitzt einen nicht unterstützten Pfad.');
  writeFileSync(join(gradleHome, 'gradle.properties'), readFileSync(join(gradleHome, 'gradle.properties'), 'utf8') + 'android.builder.sdkDownload=false\norg.gradle.java.installations.auto-download=false\norg.gradle.java.installations.paths=' + tools.javaCompilerHome.replaceAll('\\', '/') + '\n');
  const android = join(source, 'android'), appGradle = join(android, 'app', 'build.gradle');
  const generated = readFileSync(appGradle, 'utf8').split('\n// CareSuite verified local release signing')[0];
  writeFileSync(appGradle, generated + signingGradle(version.versionCode));
  writeFileSync(join(android, 'local.properties'), 'sdk.dir=' + tools.sdk.replaceAll('\\', '/') + '\n');
  const signingEnv = {
    ...env, GRADLE_USER_HOME: gradleHome, CARESUITE_LOCAL_STORE_FILE: credentials.file,
    CARESUITE_LOCAL_STORE_PASSWORD: credentials.storePassword,
    CARESUITE_LOCAL_KEY_ALIAS: credentials.keyAlias, CARESUITE_LOCAL_KEY_PASSWORD: credentials.keyPassword,
    CARESUITE_LOCAL_EXPECTED_CERT: json(join(root, 'docs/store/android-signing-identity.json')).uploadCertificateSha256,
    CARESUITE_LOCAL_UPLOAD_PROOF: join(output, 'UPLOAD-KEY-VERIFIED.json'),
  };
  console.log('Native Release-AAB mit R8 auf dem Windows-Laptop kompilieren.');
  fixedCommand('gradlew.bat :app:bundleRelease --no-daemon --console=plain', { cwd: android, env: signingEnv });
  verifyMemoryProof(memoryFile, tools.commit);
  const keyProof = json(join(output, 'UPLOAD-KEY-VERIFIED.json'));
  if (keyProof.commit !== tools.commit || keyProof.privateKeyVerified !== true || keyProof.uploadCertificateSha256 !== signingEnv.CARESUITE_LOCAL_EXPECTED_CERT) throw new Error('Der tatsächliche Compiler hat die bestehende Uploadsignierung nicht bestätigt.');
  // Only known generated native files may differ in the isolated worktree.
  if (publicCommand('git', ['diff', '--name-only'], { cwd: source }).trim()) throw new Error('Geprüfte Quelltexte wurden während des lokalen Builds verändert.');
  const bundle = join(output, 'CareSuiteHealthOS-0.4.0-code' + version.versionCode + '.aab');
  copyFileSync(join(android, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab'), bundle);
  const mappingDir = join(android, 'app', 'build', 'outputs', 'mapping', 'release');
  for (const name of ['mapping.txt', 'configuration.txt']) if (!existsSync(join(mappingDir, name))) throw new Error('Tatsächliches R8-Artefakt fehlt: ' + name);
  const r8Archive = join(output, 'R8-build-artifacts.tar.gz');
  publicCommand(process.env.CARESUITE_GITBASH_TAR || 'tar', ['--force-local', '-czf', r8Archive, '-C', mappingDir, 'mapping.txt', 'configuration.txt']);
  writeJson(join(output, 'EAS-VERSION-BASELINE.json'), { versionCode: version.baseline });
  console.log('AAB-Signatur, reservierte Version, Originalmedien und tatsächliches R8-Mapping prüfen.');
  const info = await verifyLocalAab({ bundle, r8Archive, baseline: version.baseline, code: version.versionCode, sourceRoot: root, commit: tools.commit, javaHome: tools.javaHome });
  writeJson(join(output, 'BUILD-INFO.json'), info);
  writeFileSync(join(output, 'SHA256SUMS.txt'), info.sha256 + '  ' + info.file + '\n');
  console.log('AAB FERTIG UND GEPRÜFT: ' + bundle);
  console.log('Version: ' + info.versionName + ' (' + info.versionCode + '); SHA-256: ' + info.sha256);
}

async function main() {
  const phase = process.argv[2];
  if (phase === '--preflight') preflight();
  else if (phase === '--packages') preparePackages();
  else if (phase === '--signing') checkedCredentials(json(join(state, 'TOOLS.json')));
  else if (phase === '--plan-version') {
    const plan = versionPlan(json(join(state, 'EAS-CURRENT.json')), commit());
    writeJson(join(state, 'VERSION-PLAN.json'), plan);
    console.log('In der nächsten EAS-Abfrage exakt diesen Android-Versionscode eingeben: ' + plan.versionCode);
  } else if (phase === '--confirm-version') {
    const plan = json(join(state, 'VERSION-PLAN.json'));
    checkReserved(plan, json(join(state, 'EAS-CURRENT.json')), commit());
    writeJson(join(state, 'VERSION-RESERVED.json'), plan);
  } else if (phase === '--check-reserved') checkReserved(json(join(state, 'VERSION-RESERVED.json')), json(join(state, 'EAS-CURRENT.json')), commit());
  else if (phase === '--build') await build();
  else throw new Error('Unbekannte lokale Buildphase.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error('ABBRUCH: ' + error.message); process.exitCode = 1; });
}
