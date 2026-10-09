import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compilerArchiveMetadata, compilerArchiveRoot, prepareCompilerJdk17 } from './prepare-healthos-compiler-jdk.mjs';

const bytes = Buffer.from('trusted archive fixture');
const record = { vendor: 'eclipse', version: { major: 17 }, binary: { os: 'windows', architecture: 'x64', image_type: 'jdk', jvm_impl: 'hotspot', package: { name: 'OpenJDK17U-jdk_x64_windows_hotspot_17.0.99_1.zip', checksum: createHash('sha256').update(bytes).digest('hex'), size: bytes.length, link: 'https://github.com/adoptium/temurin17-binaries/releases/download/test/OpenJDK17U-jdk_x64_windows_hotspot_17.0.99_1.zip' } } };
const folder = 'jdk-17.0.99+1';

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'healthos compiler with spaces '));
  const profile = join(root, 'user profile'), state = join(root, 'build state'); mkdirSync(profile);
  const commands = [];
  const runner = (command, args) => {
    commands.push({ command, args });
    if (args[0] === '-Z1') return { status: 0, stdout: folder + '/\n' + folder + '/bin/java.exe\n' };
    if (args[0] === '-q') {
      const home = join(args[3], folder); mkdirSync(join(home, 'bin'), { recursive: true });
      for (const name of ['java', 'javac', 'keytool', 'jarsigner']) writeFileSync(join(home, 'bin', name + '.exe'), 'existing fixture');
    }
    return { status: 0, stdout: command.endsWith('javac.exe') ? 'javac 17.0.99' : '', stderr: command.endsWith('java.exe') ? 'openjdk version "17.0.99"' : '' };
  };
  try { return Promise.resolve(run({ profile, state, runner, commands })).finally(() => rmSync(root, { recursive: true, force: true })); }
  catch (error) { rmSync(root, { recursive: true, force: true }); throw error; }
}
const fetcher = async url => url.startsWith('https://api.adoptium.net/') ? new Response(JSON.stringify([record])) : new Response(bytes);

test('compiler metadata accepts only the official JDK 17 Windows x64 archive with checksum', () => {
  assert.equal(compilerArchiveMetadata([record]).sha256, record.binary.package.checksum);
  for (const change of [value => value.version.major = 25, value => value.binary.image_type = 'jre', value => value.binary.os = 'linux', value => value.binary.package.checksum = 'invalid', value => value.binary.package.link = 'https://example.com/other.zip']) {
    const changed = structuredClone(record); change(changed); assert.throws(() => compilerArchiveMetadata([changed]));
  }
  assert.throws(() => compilerArchiveMetadata([record, record]));
});

test('compiler archives cannot traverse out of their one JDK 17 root', () => {
  assert.equal(compilerArchiveRoot([folder + '/', folder + '/bin/java.exe']), folder);
  for (const names of [['../escape'], ['/absolute'], ['C:/absolute'], [folder + '/../../escape'], ['jdk-25/bin/java.exe'], [folder + '/a', 'other/b'], [folder + '\\bin\\java.exe']]) assert.throws(() => compilerArchiveRoot(names));
});

test('no compiler download or file change is possible without approval', () => fixture(async ({ profile, state, runner, commands }) => {
  let fetches = 0;
  await assert.rejects(prepareCompilerJdk17({ userProfile: profile, state }, { windows: true, run: runner, fetcher: () => { fetches++; } }), /nicht freigegeben/);
  assert.equal(fetches, 0); assert.equal(commands.length, 0); assert.equal(existsSync(state), false);
  assert.deepEqual(readdirSync(profile), []);
}));

test('an approved checksum-verified archive becomes a portable compiler without global installation', () => fixture(async ({ profile, state, runner, commands }) => {
  const proof = await prepareCompilerJdk17({ userProfile: profile, state, unzip: 'existing unzip' }, { approved: true, windows: true, run: runner, fetcher });
  assert.equal(proof.javaMajor, 17); assert.equal(proof.downloaded, true); assert.equal(proof.archiveSha256, record.binary.package.checksum);
  assert.ok(proof.compilerHome.startsWith(join(profile, '.jdks')));
  assert.ok(existsSync(join(proof.compilerHome, 'bin/jarsigner.exe')));
  assert.ok(commands.some(value => value.args[0] === '-Z1'));
  assert.ok(commands.every(value => value.command === 'existing unzip' || /(?:java|javac)\.exe$/.test(value.command)));
  const existing = await prepareCompilerJdk17({ compilerHome: proof.compilerHome, userProfile: profile, state }, { approved: true, windows: true, run: runner, fetcher: () => { throw new Error('must not download'); } });
  assert.equal(existing.downloaded, false);
}));

test('a checksum mismatch stops before listing, extraction or compiler execution', () => fixture(async ({ profile, state, runner, commands }) => {
  const corrupted = async url => url.startsWith('https://api.adoptium.net/') ? new Response(JSON.stringify([record])) : new Response(Buffer.from('corrupt archive fixture'));
  await assert.rejects(prepareCompilerJdk17({ userProfile: profile, state }, { approved: true, windows: true, run: runner, fetcher: corrupted }), /Prüfsumme/);
  assert.equal(commands.length, 1); assert.equal(commands[0].args[0], '-v');
  assert.equal(existsSync(join(profile, '.jdks')), false);
}));

test('an existing target and failed version probe are preserved and cannot report success', () => fixture(async ({ profile, state, runner }) => {
  const target = join(profile, '.jdks', 'caresuite-temurin17-' + record.binary.package.checksum.slice(0, 12));
  mkdirSync(target, { recursive: true }); writeFileSync(join(target, 'OWN.txt'), 'must survive');
  await assert.rejects(prepareCompilerJdk17({ userProfile: profile, state }, { approved: true, windows: true, run: runner, fetcher }), /nicht überschrieben/);
  assert.ok(existsSync(join(target, 'OWN.txt')));
  rmSync(target, { recursive: true });
  const bad = (command, args) => command.endsWith('java.exe') ? { status: 0, stderr: 'openjdk version "25.0.1"' } : runner(command, args);
  await assert.rejects(prepareCompilerJdk17({ userProfile: profile, state }, { approved: true, windows: true, run: bad, fetcher }), /Java-\/Javac-Version/);
  assert.equal(existsSync(target), false);
}));
