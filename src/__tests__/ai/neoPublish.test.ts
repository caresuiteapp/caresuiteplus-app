import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { assertNeoOrigin, assertNeoReleasePaths, createNeoPublisher, neoCanonicalHash, parseNeoPublishArgs } from '../../../scripts/publish-neo.mjs';
const temps: string[] = [];
function command(root: string, args: string[], allowFailure = false) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (!allowFailure && r.status !== 0) { const error = Error(r.stderr); (error as any).gitArgs = args; throw error; }
  return r.stdout?.trim() ?? '';
}
function fixture(existingNeo = false) {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'neo publish ')); temps.push(top);
  const remote = path.join(top, 'remote.git'), root = path.join(top, 'working'), other = path.join(top, 'other');
  command(top, ['init', '--bare', '--initial-branch=main', remote]); command(top, ['clone', remote, root]);
  command(root, ['config', 'user.name', 'NEO fixture']); command(root, ['config', 'user.email', 'fixture@example.invalid']);
  fs.mkdirSync(path.join(root, 'docs')); fs.writeFileSync(path.join(root, '.gitignore'), '.env*\n.neo-runtime/\n');
  fs.writeFileSync(path.join(root, 'untouched.txt'), 'Keep main\n'); fs.writeFileSync(path.join(root, 'docs/native-workspace-source-map.json'), 'initial\n');
  if (existingNeo) fs.writeFileSync(path.join(root, 'neo.txt'), 'initial neo\n');
  command(root, ['add', '.']); command(root, ['commit', '-m', 'Base']); command(root, ['push', 'origin', 'main']); command(root, ['checkout', '-b', 'neo/r1-test']);
  fs.writeFileSync(path.join(root, 'neo.txt'), 'NEO content\n'); fs.writeFileSync(path.join(root, '.env.local'), 'SECRET=must-never-be-pushed\n');
  const manifest = { files: [{ path: 'neo.txt', sha256: neoCanonicalHash('NEO content\n') }, { path: 'docs/native-workspace-source-map.json', generated: true, sha256: neoCanonicalHash('fresh\n') }] };
  const git = (args: string[]) => args.join(' ') === 'remote get-url origin' ? 'https://github.com/caresuiteapp/caresuiteplus-app.git' : command(root, args);
  const runs: string[] = [];
  const run = (file: string) => { runs.push(file); if (file.includes('port-native')) fs.writeFileSync(path.join(root, 'docs/native-workspace-source-map.json'), 'fresh\n'); };
  const makeOther = () => {
    command(top, ['clone', remote, other]); command(other, ['config', 'user.name', 'Other fixture']); command(other, ['config', 'user.email', 'other@example.invalid']);
    return (name: string, content: string) => { fs.writeFileSync(path.join(other, name), content); command(other, ['add', name]); command(other, ['commit', '-m', 'Other update']); command(other, ['push', 'origin', 'main']); };
  };
  const execute = (options: any = {}) => createNeoPublisher({ root, publish: true, manifest, git, run, log() {}, stamp: 'fixture', ...options })();
  return { root, remote, git, runs, execute, makeOther, run, manifest };
}
afterEach(() => { temps.splice(0).forEach(p => fs.rmSync(p, { recursive: true, force: true })); });
describe('NEO release publication', () => {
  it('pushes the exact checked commit and keeps private settings out of Git', () => {
    const f = fixture(); const result = f.execute();
    expect(result.published).toBe(true); expect(command(f.remote, ['rev-parse', 'main'])).toBe(result.head);
    expect(command(f.remote, ['show', 'main:neo.txt'])).toBe('NEO content'); expect(command(f.remote, ['show', 'main:untouched.txt'])).toBe('Keep main');
    expect(command(f.remote, ['ls-tree', '-r', '--name-only', 'main'])).not.toContain('.env.local');
    expect(f.runs).toContain('scripts/verify-neo.mjs');
  });
  it('preserves newer unrelated main changes', () => {
    const f = fixture(); f.makeOther()('untouched.txt', 'Newer independent main update\n'); f.execute();
    expect(command(f.remote, ['show', 'main:untouched.txt'])).toBe('Newer independent main update');
  });
  it('resolves only the generated map conflict by regenerating from the merged sources', () => {
    const f = fixture(); f.makeOther()('docs/native-workspace-source-map.json', 'remote map\n'); fs.writeFileSync(path.join(f.root, 'docs/native-workspace-source-map.json'), 'local map\n');
    f.execute(); expect(command(f.remote, ['show', 'main:docs/native-workspace-source-map.json'])).toBe('fresh');
  });
  it('does not push when a source conflict needs review', () => {
    const f = fixture(true); f.makeOther()('neo.txt', 'Other NEO change\n'); const before = command(f.remote, ['rev-parse', 'main']);
    expect(() => f.execute()).toThrow(); expect(command(f.remote, ['rev-parse', 'main'])).toBe(before); expect(command(f.root, ['diff', '--name-only', '--diff-filter=U'])).toBe('neo.txt');
  });
  it('leaves main unchanged when verification fails', () => {
    const f = fixture(), before = command(f.remote, ['rev-parse', 'main']);
    expect(() => f.execute({ run(file: string) { if (file.includes('verify-neo')) throw Error('Test failed'); f.run(file); } })).toThrow('Test failed');
    expect(command(f.remote, ['rev-parse', 'main'])).toBe(before);
  });
  it('rejects a newer main that arrives after verification without a force push', () => {
    const f = fixture(), update = f.makeOther();
    expect(() => f.execute({ run(file: string) { f.run(file); if (file.includes('verify-neo')) update('untouched.txt', 'Concurrent update\n'); } })).toThrow();
    expect(command(f.remote, ['show', 'main:untouched.txt'])).toBe('Concurrent update'); expect(command(f.remote, ['ls-tree', '-r', '--name-only', 'main'])).not.toContain('neo.txt');
  });
  it('requires an explicit publication flag and the confirmed repository and file scope', () => {
    expect(parseNeoPublishArgs([]).publish).toBe(false); expect(parseNeoPublishArgs(['--publish']).publish).toBe(true);
    expect(() => assertNeoOrigin('https://github.com/other/repository.git')).toThrow();
    expect(() => assertNeoReleasePaths(['.env.local'], new Set(['.env.local']))).toThrow();
    const f = fixture(); fs.writeFileSync(path.join(f.root, 'untouched.txt'), 'Unrelated local edit'); expect(() => f.execute()).toThrow('außerhalb');
  });
});
