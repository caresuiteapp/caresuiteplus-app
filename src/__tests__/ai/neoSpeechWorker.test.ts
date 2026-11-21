import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createNeoSpeech } from '../../ai/robot/neoSpeech.web';
import { NEO_INTRODUCTION } from '../../ai/robot/neoCommands';

const worker = readFileSync(new URL('../../../public/neo-voice/v1/neo-worker.js', import.meta.url), 'utf8');
function helpers(extra = '', environment: Record<string, unknown> = {}) {
  const sandbox: Record<string, any> = { URL, Float32Array, crypto: webcrypto, self: { fetch: () => {}, location: { href: 'https://example.test/neo-voice/v1/neo-worker.js', origin: 'https://example.test' } }, importScripts: () => {}, ort: { env: { wasm: {} } }, ...environment };
  vm.runInNewContext(worker + '\nconfig = { phoneme_id_map: { "$": [2] } }; globalThis.test = { sentenceInputs, joinSentences, wav, loadModel, speechIds };\n' + extra, sandbox);
  return sandbox.test;
}
describe('Neo speech continuity', () => {
  it('loads the spoken startup greeting from bundled audio without requiring a Worker', async () => {
    const speech = createNeoSpeech();
    try {
      const bytes = new Uint8Array(await speech.loadVoice('neo:conversation', new AbortController().signal, NEO_INTRODUCTION));
      expect(bytes.length).toBeGreaterThan(1000);
      expect(String.fromCharCode(...bytes.slice(0, 3))).toBe('ID3');
    } finally { speech.dispose(); }
  });
  it('also reuses bundled navigation recordings when a conversation supplies their text', async () => {
    const speech = createNeoSpeech();
    try {
      const bytes = new Uint8Array(await speech.loadVoice('neo:conversation', new AbortController().signal, 'Klar, zum Kalender.'));
      expect(bytes.length).toBeGreaterThan(1000);
      expect(String.fromCharCode(...bytes.slice(0, 3))).toBe('ID3');
    } finally { speech.dispose(); }
  });
  it('assembles parallel model parts in manifest order with at most three active downloads', async () => {
    let active = 0, maximum = 0;
    const pieces = [1, 2, 3, 4, 5].map(value => new Uint8Array([value]).buffer);
    const parts = pieces.map((data, index) => ({ file: String(index), bytes: data.byteLength, sha256: createHash('sha256').update(new Uint8Array(data)).digest('hex') }));
    const testFileBytes = async (name: string) => {
      active++; maximum = Math.max(maximum, active);
      await new Promise(resolve => setTimeout(resolve, (5 - Number(name)) * 2));
      active--; return pieces[Number(name)];
    };
    const { loadModel } = helpers('fileBytes = testFileBytes;', { testFileBytes });
    expect(Array.from(await loadModel(parts))).toEqual([1, 2, 3, 4, 5]);
    expect(maximum).toBe(3);
  });
  it('rejects corrupted model parts and evicts their cache entry', async () => {
    const remove = vi.fn();
    const { loadModel } = helpers('fileBytes = async () => new Uint8Array([1]).buffer;', { caches: { open: async () => ({ delete: remove }) } });
    await expect(loadModel([{ file: 'voice-00.bin', bytes: 1, sha256: '0'.repeat(64) }])).rejects.toThrow('voice-model-integrity');
    expect(remove).toHaveBeenCalledWith('https://example.test/neo-voice/v1/voice-00.bin');
  });
  it('uses English phonemes for both compact brand names and the OS letters', () => {
    const pronounce = vi.fn().mockReturnValue({ phoneme_ids: [1, 0, 7, 0, 2], phonemes: ['x'] });
    const { speechIds } = helpers('config = { espeak: { voice: "de" }, phoneme_id_map: { "^": [1], "_": [0], "$": [2], x: [7], " ": [3], ".": [4] } }; phonemize = pronounce;', { pronounce });
    expect(speechIds('Dein CareSuite+ HealthOS.').length).toBeGreaterThan(0);
    expect(pronounce.mock.calls.some(([text, language]) => text.includes('Care Suite') && text.includes('Health O S') && language === 'en-us')).toBe(true);
  });
  it('keeps each sentence frame intact instead of inferring across multiple end/start markers', () => {
    const { sentenceInputs } = helpers();
    expect(sentenceInputs([1, 0, 18, 0, 2, 1, 0, 25, 0, 2])).toEqual([[1, 0, 18, 0, 2], [1, 0, 25, 0, 2]]);
    expect(() => sentenceInputs([1, 0, 18])).toThrow();
  });
  it('keeps the sentence audio at its original sample rate, adds breathing room, and softens only edges', () => {
    const { joinSentences, wav } = helpers();
    const first = new Float32Array(2205).fill(0.2), second = new Float32Array(2205).fill(-0.2);
    const joined: Float32Array = joinSentences([first, second], 22050);
    expect(joined.length).toBeGreaterThan(first.length + second.length);
    expect(joined[0]).toBe(0); expect(joined.at(-1)).toBe(0);
    expect(Array.from(joined).filter(x => x > 0.19).length).toBeGreaterThan(1700);
    expect(Array.from(joined).filter(x => x < -0.19).length).toBeGreaterThan(1700);
    const positiveEnd = joined.findLastIndex(x => x > 0), negativeStart = joined.findIndex(x => x < 0);
    expect((negativeStart - positiveEnd) / 22050).toBeGreaterThanOrEqual(0.24);
    const encoded = new DataView(wav(joined, 22050));
    expect(encoded.getUint32(24, true)).toBe(22050);
    expect(encoded.getInt16(44, true)).toBe(0);
    expect(encoded.getInt16(encoded.byteLength - 2, true)).toBe(0);
  });
});
