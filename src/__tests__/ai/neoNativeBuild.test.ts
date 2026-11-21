import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildNeoNative, neoNativeCpuSupported, verifyNeoNativeSources } from '../../../scripts/build-neo-native.mjs';

const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true }))); });
async function copySources() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'neo native sources ')); temporary.push(directory);
  await fs.cp('vendor/neo-whisper', directory, { recursive: true }); return directory;
}
describe('NEO native source build boundary', () => {
  it('requires all AVX2/FMA/F16C capabilities without matching partial flag names', () => {
    expect(neoNativeCpuSupported('flags : sse2 avx2 fma f16c')).toBe(true);
    expect(neoNativeCpuSupported('flags : sse2 notavx2 fma f16c')).toBe(false);
    expect(neoNativeCpuSupported('flags : avx2 fma')).toBe(false);
    expect(neoNativeCpuSupported('')).toBe(false);
  });
  it('verifies the pinned upstream source closure with all retained license inputs', async () => {
    const manifest = await verifyNeoNativeSources();
    expect(manifest.commit).toBe('9386f239401074690479731c1e41683fbbeac557');
    expect(manifest.sources).toHaveLength(30);
    expect(manifest.files.map((item: { path: string }) => item.path)).toEqual(expect.arrayContaining(['LICENSE', 'AUTHORS', 'examples/miniaudio.h', 'examples/stb_vorbis.c']));
  });
  it('accepts equivalent Windows line endings but rejects altered source content', async () => {
    const directory = await copySources(); const manifest = await verifyNeoNativeSources(directory);
    for (const item of manifest.files) {
      const file = path.join(directory, item.path); await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n'));
    }
    const metadata = path.join(directory, 'source-manifest.json'); await fs.writeFile(metadata, (await fs.readFile(metadata, 'utf8')).replace(/\n/g, '\r\n'));
    await expect(verifyNeoNativeSources(directory)).resolves.toMatchObject({ version: 'v1.8.4' });
    await fs.appendFile(path.join(directory, 'include/whisper.h'), '\n// independently changed\n');
    await expect(verifyNeoNativeSources(directory)).rejects.toThrow('source integrity failed');
  });
  it('does not probe or install toolchains on another platform', async () => {
    const execute = vi.fn();
    const result = await buildNeoNative({ platform: 'win32', arch: 'x64', execute, log() {} });
    expect(result.available).toBe(false); expect(execute).not.toHaveBeenCalled();
    await expect(buildNeoNative({ platform: 'win32', arch: 'x64', required: true, execute, log() {} })).rejects.toThrow('Linux x64');
  });
  it('keeps native readiness false when an existing compiler is missing', async () => {
    const execute = vi.fn().mockRejectedValue(Error('ENOENT'));
    expect(await buildNeoNative({ platform: 'linux', arch: 'x64', execute, log() {} })).toMatchObject({ available: false });
    expect(execute).toHaveBeenCalledWith('g++', ['--version']);
  });
  it('does not create an advertised executable or manifest after compilation fails', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'neo failed build ')); temporary.push(directory);
    const execute = vi.fn(async (_command: string, args: string[]) => {
      if (args[0] === '--version') return { stdout: 'existing compiler', stderr: '' };
      expect(args).not.toContain('-march=native'); expect(args).not.toContain('-static');
      throw Error('synthetic compile failure');
    });
    expect(await buildNeoNative({ platform: 'linux', arch: 'x64', outputDirectory: directory, cpuInfo: 'flags : avx2 fma f16c', execute, log() {} })).toMatchObject({ available: false });
    expect(await fs.readdir(directory)).toEqual([]);
  });
});
