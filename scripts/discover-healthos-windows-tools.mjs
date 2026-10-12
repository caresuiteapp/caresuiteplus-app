import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { supportsJava } from './healthos-gradle-compatibility.mjs';

export const requiredSdkPackages = Object.freeze({
  api36: 'platforms;android-36',
  buildTools36: 'build-tools;36.0.0',
  ndk27: 'ndk;27.1.12297006',
  cmake322: 'cmake;3.22.1',
});

// Paths and versions are public diagnostic data. Credentials and the complete
// environment are deliberately never collected by this module.
export function nativeToolPath(value, windows = process.platform === 'win32') {
  if (typeof value !== 'string') return null;
  let path = value.trim();
  if (path.startsWith('"') && path.endsWith('"')) path = path.slice(1, -1);
  if (!path || /[\r\n\0]/.test(path)) return null;
  if (windows) {
    path = path.replace(/^\/cygdrive\/([a-z])\//i, (_, drive) => drive.toUpperCase() + ':/');
    path = path.replace(/^\/([a-z])\//i, (_, drive) => drive.toUpperCase() + ':/');
  }
  return path;
}

function directories(path) {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter(entry => entry.isDirectory() || entry.isSymbolicLink())
      .map(entry => entry.name).sort().slice(0, 64);
  } catch { return []; }
}

function collector(windows) {
  const values = [], seen = new Set();
  return {
    values,
    add(value, source) {
      const native = nativeToolPath(value, windows);
      if (!native) return;
      const path = resolve(native), id = windows ? path.toLowerCase() : path;
      if (seen.has(id)) return;
      seen.add(id);
      values.push({ path, source });
    },
  };
}

function versionCommand(run, file, args) {
  try {
    return run(file, args, { encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 128 * 1024 });
  } catch { return { status: null }; }
}

function where(run, name, windows) {
  if (!windows) return [];
  const result = versionCommand(run, 'where.exe', [name]);
  return result.status === 0 ? String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean) : [];
}

function existingProperty(file, key) {
  try {
    // Read only the requested public path, not credentials or arbitrary config.
    if (statSync(file).size > 65536) return null;
    const text = readFileSync(file, 'utf8');
    const line = text.split(/\r?\n/).find(value => value.trimStart().startsWith(key + '='));
    return line ? line.trimStart().slice(key.length + 1).replace(/\\([\\:= ])/g, '$1') : null;
  } catch { return null; }
}

export function discoverJava({ env = process.env, windows = process.platform === 'win32', run = spawnSync, projectRoot, gradleVersion } = {}) {
  const candidates = collector(windows), suffix = windows ? '.exe' : '';
  for (const key of ['JAVA_HOME', 'JDK_HOME', 'ANDROID_STUDIO_JDK', 'STUDIO_JDK']) candidates.add(env[key], key);
  if (projectRoot) candidates.add(existingProperty(join(projectRoot, '.gradle', 'config.properties'), 'java.home'), 'Projekt: Gradle-JDK');
  for (const tool of ['javac', 'java']) {
    for (const file of where(run, tool + suffix, windows)) {
      let actual = file;
      try { actual = realpathSync(file); } catch { /* Report a broken PATH entry below. */ }
      candidates.add(resolve(dirname(actual), '..'), 'PATH: ' + tool);
    }
  }
  const roots = [];
  for (const parent of [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Programs')].filter(Boolean)) {
    for (const name of ['Java', 'Eclipse Adoptium', 'AdoptOpenJDK', 'Microsoft', 'Zulu', 'Amazon Corretto', 'BellSoft', 'Semeru', 'Android']) roots.push([join(parent, name), 2]);
    candidates.add(join(parent, 'Android', 'Android Studio', 'jbr'), 'Android Studio');
  }
  if (env.LOCALAPPDATA) {
    roots.push([join(env.LOCALAPPDATA, 'JetBrains', 'Toolbox', 'apps', 'AndroidStudio'), 4]);
    roots.push([join(env.LOCALAPPDATA, 'Programs', 'Android Studio'), 2]);
  }
  if (env.USERPROFILE) roots.push([join(env.USERPROFILE, '.jdks'), 2], [join(env.USERPROFILE, '.gradle', 'jdks'), 2]);
  const gradleCache = nativeToolPath(env.GRADLE_USER_HOME, windows);
  if (gradleCache) roots.push([join(gradleCache, 'jdks'), 2]);
  if (projectRoot) roots.push([join(projectRoot, '.healthos-gitbash', 'gradle', 'jdks'), 2]);
  const scanned = new Set();
  function walk(folder, depth, budget) {
    const id = resolve(folder).toLowerCase();
    if (scanned.has(id) || budget.count >= 128) return;
    scanned.add(id);
    budget.count++;
    if (existsSync(join(folder, 'bin', 'java' + suffix))) {
      candidates.add(folder, 'Vorhandenes Java-Verzeichnis');
      return;
    }
    if (depth > 0) for (const name of directories(folder)) walk(join(folder, name), depth - 1, budget);
  }
  for (const [folder, depth] of roots) walk(folder, depth, { count: 0 });
  const records = candidates.values.map(({ path: home, source }) => {
    const tools = ['java', 'javac', 'keytool', 'jarsigner'];
    const missingTools = tools.filter(name => !existsSync(join(home, 'bin', name + suffix)));
    let major = null, compilerMajor = null;
    if (!missingTools.includes('java')) {
      const result = versionCommand(run, join(home, 'bin', 'java' + suffix), ['-version']);
      const match = (String(result.stderr || '') + '\n' + String(result.stdout || '')).match(/(?:openjdk|java)\s+(?:version\s+)?"?(\d+)(?:[.\s"]|$)/i);
      if (result.status === 0 && match) major = Number(match[1]);
    }
    if (!missingTools.includes('javac')) {
      const result = versionCommand(run, join(home, 'bin', 'javac' + suffix), ['-version']);
      const match = (String(result.stderr || '') + '\n' + String(result.stdout || '')).match(/javac\s+(\d+)(?:[.\s]|$)/i);
      if (result.status === 0 && match) compilerMajor = Number(match[1]);
    }
    const compatible = supportsJava(major, gradleVersion);
    const supported = missingTools.length === 0 && compatible && compilerMajor === major;
    const reason = missingTools.length ? 'Unvollständiges JDK' : !major || !compilerMajor ? 'Java-Versionsabfrage fehlgeschlagen' : major !== compilerMajor ? 'java und javac verwenden unterschiedliche Hauptversionen' : !compatible ? 'Freigegeben: JDK 17/21; JDK 25 zusätzlich mit bestätigtem Gradle ab 9.1' : null;
    return { home, source, exists: existsSync(home), major, compilerMajor, supported, missingTools, reason };
  });
  const explicit = records.find(value => value.supported && ['JAVA_HOME', 'JDK_HOME', 'ANDROID_STUDIO_JDK', 'STUDIO_JDK', 'Projekt: Gradle-JDK'].includes(value.source));
  const selected = explicit || records.find(value => value.supported && value.major === 17) || records.find(value => value.supported);
  const compiler = records.find(value => value.supported && value.major === 17);
  return { selected: selected ? { home: selected.home, major: selected.major } : null, compiler: compiler ? { home: compiler.home, major: 17 } : null, candidates: records, searchRoots: roots.map(([folder]) => folder) };
}

export function sdkComponents(sdk, windows = process.platform === 'win32') {
  const suffix = windows ? '.exe' : '', host = windows ? 'windows-x86_64' : process.platform === 'darwin' ? 'darwin-x86_64' : 'linux-x86_64';
  const ndk = join(sdk, 'ndk', '27.1.12297006');
  return {
    api36: existsSync(join(sdk, 'platforms', 'android-36', 'android.jar')),
    buildTools36: existsSync(join(sdk, 'build-tools', '36.0.0', 'aapt2' + suffix)),
    ndk27: existsSync(join(ndk, 'source.properties')) && existsSync(join(ndk, 'build', 'cmake', 'android.toolchain.cmake')) && existsSync(join(ndk, 'toolchains', 'llvm', 'prebuilt', host, 'bin', 'clang' + suffix)),
    cmake322: ['cmake', 'ninja'].every(name => existsSync(join(sdk, 'cmake', '3.22.1', 'bin', name + suffix))),
  };
}

export function discoverSdk({ env = process.env, windows = process.platform === 'win32', run = spawnSync, projectRoot } = {}) {
  const candidates = collector(windows);
  for (const key of ['ANDROID_HOME', 'ANDROID_SDK_ROOT']) candidates.add(env[key], key);
  if (projectRoot) {
    for (const folder of ['android', '.healthos-gitbash/source/android']) candidates.add(existingProperty(join(projectRoot, folder, 'local.properties'), 'sdk.dir'), 'Projekt: ' + folder);
  }
  if (env.LOCALAPPDATA) candidates.add(join(env.LOCALAPPDATA, 'Android', 'Sdk'), 'Windows: Android-SDK');
  if (env.USERPROFILE) {
    candidates.add(join(env.USERPROFILE, 'AppData', 'Local', 'Android', 'Sdk'), 'Benutzer: Android-SDK');
    for (const folder of ['Android/Sdk', 'Android/android-sdk', 'android-sdk']) candidates.add(join(env.USERPROFILE, folder), 'Benutzer: SDK-Verzeichnis');
  }
  if (windows) for (const folder of ['C:/Android/Sdk', 'C:/Android/android-sdk', 'C:/android-sdk']) candidates.add(folder, 'Windows: SDK-Verzeichnis');
  for (const parent of [env.ProgramFiles, env['ProgramFiles(x86)']].filter(Boolean)) candidates.add(join(parent, 'Android', 'android-sdk'), 'Programme: Android-SDK');
  for (const file of where(run, 'adb' + (windows ? '.exe' : ''), windows)) candidates.add(resolve(dirname(file), '..'), 'PATH: adb');
  for (const file of where(run, 'sdkmanager' + (windows ? '.bat' : ''), windows)) {
    const tools = resolve(dirname(file), '..');
    candidates.add(tools.includes('cmdline-tools') ? resolve(tools, '../..') : resolve(tools, '..'), 'PATH: sdkmanager');
  }
  const records = candidates.values.map(({ path: sdk, source }) => {
    const components = sdkComponents(sdk, windows);
    const missingPackages = Object.keys(requiredSdkPackages).filter(key => !components[key]).map(key => requiredSdkPackages[key]);
    return {
      sdk, source, exists: existsSync(sdk), components, complete: missingPackages.length === 0, missingPackages,
      installedVersions: { platforms: directories(join(sdk, 'platforms')), buildTools: directories(join(sdk, 'build-tools')), ndk: directories(join(sdk, 'ndk')), cmake: directories(join(sdk, 'cmake')) },
    };
  });
  const available = records.filter(value => value.exists);
  const selected = available.find(value => value.complete) || available.sort((a, b) => Object.values(b.components).filter(Boolean).length - Object.values(a.components).filter(Boolean).length)[0];
  return { selected: selected || null, candidates: records };
}
