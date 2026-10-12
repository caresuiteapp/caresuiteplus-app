import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const directories: string[] = [];
const commit = 'a'.repeat(40);
const fixture = () => ({
  id: '821300e7-838d-4289-9087-b1b0a7b4bf41', platform: 'ANDROID', status: 'FINISHED',
  appVersion: '0.4.0', appBuildVersion: '41', buildProfile: 'healthos-full-aab', gitCommitHash: commit,
  project: { id: '567bda34-8356-4de8-9349-a0de3143567e' }, artifacts: { buildUrl: 'https://artifacts.example.test/full.aab' },
});
function run(value: unknown, baseline: unknown = '40') {
  const dir = mkdtempSync(join(tmpdir(), 'healthos-full-build-'));
  directories.push(dir);
  const result = join(dir, 'result.json'); const remote = join(dir, 'remote.json');
  writeFileSync(result, JSON.stringify(value)); writeFileSync(remote, JSON.stringify({ versionCode: baseline }));
  const child = spawnSync(process.execPath, ['scripts/validate-healthos-full-build.mjs', result, remote, commit, dir], {
    cwd: process.cwd(), encoding: 'utf8',
  });
  return { dir, status: child.status, output: child.stdout + child.stderr };
}
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('full native AAB response verification', () => {
  it('accepts exactly the new full build and persists its exact download inputs', () => {
    const result = run([fixture()]);
    expect(result.status).toBe(0);
    expect(readFileSync(join(result.dir, 'build-code.txt'), 'utf8')).toBe('41');
    expect(readFileSync(join(result.dir, 'download-url.txt'), 'utf8')).toBe('https://artifacts.example.test/full.aab');
  });

  it('accepts a later increment without assuming the next build is exactly 41', () => {
    expect(run({ ...fixture(), appBuildVersion: '47' }, '46').status).toBe(0);
  });

  it.each([
    ['old portal profile', { buildProfile: 'portal-only-aab' }],
    ['unchanged build code', { appBuildVersion: '39' }],
    ['wrong app version', { appVersion: '0.3.6' }],
    ['wrong project', { project: { id: 'another-project' } }],
    ['wrong commit', { gitCommitHash: 'b'.repeat(40) }],
    ['failed build', { status: 'ERRORED' }],
    ['wrong platform', { platform: 'IOS' }],
    ['APK artifact', { artifacts: { buildUrl: 'https://artifacts.example.test/full.apk' } }],
    ['insecure URL', { artifacts: { buildUrl: 'http://artifacts.example.test/full.aab' } }],
    ['embedded credentials', { artifacts: { buildUrl: 'https://name:password@artifacts.example.test/full.aab' } }],
    ['missing artifact', { artifacts: {} }],
  ] as const)('rejects %s before writing download inputs', (_label, override) => {
    const result = run({ ...fixture(), ...override });
    expect(result.status).not.toBe(0);
    expect(readdirSync(result.dir).sort()).toEqual(['remote.json', 'result.json']);
  });

  it('rejects a code that does not exceed the observed remote basis', () => {
    expect(run(fixture(), '41').status).not.toBe(0);
  });

  it.each(['38', '39', '', 'invalid'])('rejects invalid or outdated remote basis %s', baseline => {
    expect(run(fixture(), baseline).status).not.toBe(0);
  });

  it('rejects an ambiguous multi-build response', () => {
    expect(run([fixture(), fixture()]).status).not.toBe(0);
  });
});
