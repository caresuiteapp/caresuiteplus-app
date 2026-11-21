import { readFile, writeFile, access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { createNeoRuntime } from '../../../neo-service/runtime.mjs';
import { createNeoServer } from '../../../neo-service/server.mjs';
import { downloadNeoAsset } from '../../../scripts/prepare-neo-local.mjs';
import { encodeNeoWav } from '@/ai/neo/neoAudio';
async function invoke(server: ReturnType<typeof createNeoServer>, path: string, body: string, auth = 'Bearer ' + 's'.repeat(48), method = 'POST') {
  let data = ''; const req = Readable.from([Buffer.from(body)]) as any; req.method = method; req.url = path; req.headers = { authorization: auth, 'content-type': 'application/json' };
  const response = new Writable({ write(chunk, _, cb) { data += chunk; cb(); } }) as any;
  let status = 0; response.writeHead = (code: number) => { status = code; };
  const done = new Promise<void>(resolve => response.on('finish', resolve)); server.emit('request', req, response); await done; return { status, data: JSON.parse(data) };
}
describe('own NEO service and pinned asset transport', () => {
  it('requires a strong service secret and authenticated allowlisted requests', async () => {
    expect(() => createNeoServer({ token: 'short' })).toThrow();
    const runtime = { status: vi.fn().mockResolvedValue({ transcriptionReady: true }), transcribe: vi.fn(), analyze: vi.fn() }, server = createNeoServer({ token: 's'.repeat(48) }, runtime);
    expect((await invoke(server, '/v1/status', '{}', '')).status).toBe(401); expect(runtime.status).not.toHaveBeenCalled();
    expect((await invoke(server, '/v1/delete', '{}')).status).toBe(404);
    expect((await invoke(server, '/v1/status', 'bad json')).status).toBe(400);
    expect(await invoke(server, '/v1/status', '{}')).toMatchObject({ status: 200, data: { ok: true, transcriptionReady: true } });
  });
  it('bounds service input and does not disclose engine errors or private paths', async () => {
    const runtime = { status: vi.fn(), transcribe: vi.fn().mockRejectedValue(Error('/secret/patient/path.wav')), analyze: vi.fn() }, server = createNeoServer({ token: 's'.repeat(48) }, runtime);
    const result = await invoke(server, '/v1/transcribe', '{"audio":"AAAA"}'); expect(result).toMatchObject({ status: 400, data: { ok: false, error: 'processing-failed' } });
    expect(JSON.stringify(result)).not.toContain('patient'); expect((await invoke(server, '/v1/transcribe', 'x'.repeat(900001))).status).toBe(413);
  });
  it('skips silent audio before invoking an engine and exposes missing setup honestly', async () => {
    const runtime = createNeoRuntime({}); expect(await runtime.status()).toEqual({ transcriptionReady: false, modelReady: false });
    expect(await runtime.transcribe(Buffer.from(encodeNeoWav(new Float32Array(16000), 16000)).toString('base64'), new AbortController().signal)).toMatchObject({ text: '' });
    const samples = new Float32Array(16000).fill(.1); await expect(runtime.transcribe(Buffer.from(encodeNeoWav(samples, 16000)).toString('base64'), new AbortController().signal)).rejects.toThrow('not-configured');
  });
  it('accepts only verified complete asset downloads and preserves the last valid file on corruption', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'neo-asset-test-')), path = join(directory, 'asset.bin'), bytes = Buffer.from('verified file');
    const asset = { url: 'https://example.test/model', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    try {
      const fetcher = vi.fn().mockResolvedValue(new Response(bytes)); await downloadNeoAsset(path, asset, fetcher); expect(await readFile(path)).toEqual(bytes);
      await downloadNeoAsset(path, asset, fetcher); expect(fetcher).toHaveBeenCalledTimes(1);
      await expect(downloadNeoAsset(path, { ...asset, sha256: '0'.repeat(64) }, async () => new Response(bytes))).rejects.toThrow('Integritätsprüfung');
      expect(await readFile(path)).toEqual(bytes);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
