import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const worker = readFileSync(new URL('../../../public/neo-voice/v1/neo-worker.js', import.meta.url), 'utf8');
function helpers() {
  const sandbox: Record<string, any> = { URL, Float32Array, self: { fetch: () => {}, location: { href: 'https://example.test/neo-voice/v1/neo-worker.js', origin: 'https://example.test' } }, importScripts: () => {}, ort: { env: { wasm: {} } } };
  vm.runInNewContext(worker + '\nconfig = { phoneme_id_map: { "$": [2] } }; globalThis.test = { sentenceInputs, joinSentences, wav };', sandbox);
  return sandbox.test;
}
describe('Neo speech continuity', () => {
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
