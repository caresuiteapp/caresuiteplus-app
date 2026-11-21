import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const upstreamCommit = '9386f239401074690479731c1e41683fbbeac557';
const sourceManifestHash = 'd0a61b928a41d045b07fcf3d97c653927171220ad7441624186c090ccba96984';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const canonical = text => text.replace(/\r\n?/g, '\n');
const safeRelative = value => typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) && !value.includes('\\') && !value.split('/').some(part => part === '..' || part === '.' || part === '');

export function neoNativeCpuSupported(cpuInfo) {
  const flags = String(cpuInfo).split(/\r?\n/).find(line => /^flags\s*:/i.test(line));
  const values = new Set((flags?.split(':')[1] ?? '').trim().split(/\s+/));
  return ['avx2', 'fma', 'f16c'].every(feature => values.has(feature));
}

export async function verifyNeoNativeSources(directory = path.join(root, 'vendor/neo-whisper')) {
  const manifestFile = path.join(directory, 'source-manifest.json');
  const manifestText = canonical(await fs.readFile(manifestFile, 'utf8'));
  if (sha(manifestText) !== sourceManifestHash) throw Error('NEO native source manifest integrity failed.');
  const manifest = JSON.parse(manifestText);
  if (manifest.version !== 'v1.8.4' || manifest.commit !== upstreamCommit || manifest.sources.length !== 30 || !Array.isArray(manifest.files)) throw Error('NEO native source version is not pinned.');
  const names = new Set();
  for (const item of manifest.files) {
    if (!safeRelative(item.path) || names.has(item.path) || !/^[a-f0-9]{64}$/.test(item.sha256CanonicalLF)) throw Error('NEO native source manifest contains an invalid path.');
    names.add(item.path);
    const target = path.join(directory, item.path), stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink() || sha(canonical(await fs.readFile(target, 'utf8'))) !== item.sha256CanonicalLF) throw Error('NEO native source integrity failed: ' + item.path);
  }
  if (!manifest.sources.every(file => safeRelative(file) && names.has(file)) || !manifest.includeDirectories.every(safeRelative)) throw Error('NEO native compilation inputs are invalid.');
  return manifest;
}

function execute(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '', stderr = '', finished = false;
    const timer = setTimeout(() => child.kill('SIGKILL'), 120000);
    child.stdout.on('data', value => { stdout += value; if (stdout.length > 1024 * 1024) child.kill('SIGKILL'); });
    child.stderr.on('data', value => { stderr += value; if (stderr.length > 1024 * 1024) child.kill('SIGKILL'); });
    const done = (error, code) => {
      if (finished) return; finished = true; clearTimeout(timer);
      if (error || code !== 0) reject(Error(error?.message ?? `${command} exited ${code}: ${stderr.slice(-8000)}`));
      else resolve({ stdout, stderr });
    };
    child.once('error', error => done(error)); child.once('close', code => done(null, code));
  });
}

/** Compile in the deployment build image; never redistribute a host-built libc runtime. */
export async function buildNeoNative(options = {}) {
  const outputDirectory = path.resolve(options.outputDirectory ?? path.join(root, 'api/_lib/neo-assets'));
  const platform = options.platform ?? process.platform, arch = options.arch ?? process.arch;
  const log = options.log ?? console.log, run = options.execute ?? execute;
  const unavailable = reason => { if (options.required) throw Error(reason); log('NEO native CPU build unavailable: ' + reason); return { available: false, reason }; };
  if (platform !== 'linux' || arch !== 'x64') return unavailable('Linux x64 is required; portable WASM remains available.');
  const sourceDirectory = path.resolve(options.sourceDirectory ?? path.join(root, 'vendor/neo-whisper'));
  const manifest = await verifyNeoNativeSources(sourceDirectory);
  let cxx, cc;
  try { cxx = await run('g++', ['--version']); cc = await run('gcc', ['--version']); }
  catch { return unavailable('The existing build image does not provide GCC/G++; no compiler was installed.'); }
  let cpuInfo;
  try { cpuInfo = options.cpuInfo ?? await fs.readFile('/proc/cpuinfo', 'utf8'); } catch { return unavailable('The build CPU capabilities could not be checked.'); }
  if (!neoNativeCpuSupported(cpuInfo)) return unavailable('The build CPU lacks AVX2/FMA/F16C, so a native self-test is not safe.');
  const jobs = Math.max(1, Math.min(4, Number.isInteger(options.jobs) ? options.jobs : 2));
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'caresuite-neo-native-'));
  const includes = manifest.includeDirectories.map(value => '-I' + path.join(sourceDirectory, value));
  const flags = ['-O3', '-mavx2', '-mfma', '-mf16c', '-DNDEBUG', '-D_GNU_SOURCE', '-DGGML_USE_CPU',
    '-DWHISPER_VERSION="1.8.4"', '-DGGML_VERSION="0.9.8"', `-DGGML_COMMIT="${upstreamCommit}"`, '-pthread', ...includes];
  try {
    log('Building pinned NEO native CPU engine with existing GCC/G++ (' + jobs + ' jobs).');
    const objects = manifest.sources.map(file => path.join(temporary, file.replaceAll('/', '_') + '.o'));
    let next = 0, firstFailure;
    await Promise.all(Array.from({ length: jobs }, async () => {
      while (!firstFailure && next < manifest.sources.length) {
        const index = next++, source = manifest.sources[index], isC = source.endsWith('.c');
        try { await run(isC ? 'gcc' : 'g++', [...flags, isC ? '-std=c11' : '-std=c++17', '-c', path.join(sourceDirectory, source), '-o', objects[index]]); }
        catch (error) { firstFailure = error; }
      }
    }));
    if (firstFailure) throw firstFailure;
    const binary = path.join(temporary, 'whisper-cli');
    // System libstdc++, glibc, pthread and dl are dynamically linked. No -static.
    await run('g++', [...objects, '-pthread', '-ldl', '-lm', '-o', binary]);
    const bytes = await fs.readFile(binary);
    if (bytes.length < 64 || bytes.length > 40000000 || bytes[0] !== 0x7f || bytes.toString('ascii', 1, 4) !== 'ELF' || bytes[4] !== 2 || bytes.readUInt16LE(18) !== 62) throw Error('The built NEO engine is not a bounded Linux x64 executable.');
    const help = await run(binary, ['--help']);
    if (!/whisper|--model/i.test(help.stdout + help.stderr)) throw Error('The NEO engine did not return its CLI help contract.');
    const native = { file: 'whisper-cli', size: bytes.length, sha256: sha(bytes), version: 'whisper.cpp-v1.8.4' };
    const record = { source: manifest.upstream, commit: upstreamCommit, sourceManifestSHA256: sourceManifestHash, native,
      cCompiler: cc.stdout.split(/\r?\n/)[0], cxxCompiler: cxx.stdout.split(/\r?\n/)[0],
      link: 'dynamic target-build-image system runtime', requiredRuntimeCpuFeatures: ['avx2', 'fma', 'f16c'],
      buildPlatform: platform + '-' + arch, cliHelpPassed: true, modelInferencePassed: false, vercelLambdaValidated: false };
    await fs.mkdir(outputDirectory, { recursive: true });
    const staging = path.join(outputDirectory, '.whisper-cli-' + crypto.randomBytes(5).toString('hex'));
    try { await fs.writeFile(staging, bytes, { mode: 0o500 }); await fs.rename(staging, path.join(outputDirectory, native.file)); }
    finally { await fs.rm(staging, { force: true }); }
    await fs.writeFile(path.join(outputDirectory, 'native-build.json'), JSON.stringify(record, null, 2) + '\n');
    log('NEO native CPU engine built and CLI ABI checked; request-runtime CPU/ABI and recognition checks remain required.');
    return { available: true, native, buildRecord: record };
  } catch (error) { return unavailable(error instanceof Error ? error.message : 'Native CPU compilation failed.'); }
  finally { await fs.rm(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2); let required = false, outputDirectory;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--required') required = true;
    else if (args[index] === '--output' && args[index + 1]) outputDirectory = args[++index];
    else throw Error('Allowed: --required [--output DIRECTORY].');
  }
  buildNeoNative({ required, outputDirectory }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
