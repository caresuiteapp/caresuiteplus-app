import { describe, expect, it } from 'vitest';
import { encodeNeoWav, neoBase64 } from '@/ai/neo/neoAudio';
import { validateNeoWav } from '../../../neo-service/runtime.mjs';
import { decodeNeoPcmRecording } from '@/ai/neo/neoRecordingAudio';
describe('NEO audio transport', () => {
  it('imports an existing PCM recording without changing its length or channel values', () => {
    const input = Float32Array.from({ length: 16000 }, (_, i) => Math.sin(i * .1) * .2), audio = decodeNeoPcmRecording(encodeNeoWav(input, 16000));
    expect(audio.rate).toBe(16000); expect(audio.samples).toHaveLength(16000); expect(audio.samples[125]).toBeCloseTo(input[125], 4);
  });
  it('rejects compressed, truncated and oversized native recordings instead of treating them as PCM', () => {
    expect(() => decodeNeoPcmRecording(new Uint8Array(100))).toThrow();
    expect(() => decodeNeoPcmRecording(encodeNeoWav(new Float32Array(16000), 16000).subarray(0, 100))).toThrow();
    expect(() => decodeNeoPcmRecording(new Uint8Array(30 * 1024 * 1024 + 1))).toThrow();
  });
  it.each([16000, 44100, 48000])('creates valid 16k mono PCM from %i Hz without changing duration', rate => {
    const input = Float32Array.from({ length: rate }, (_, i) => Math.sin(i / rate * 440 * Math.PI * 2) * .25);
    const wav = encodeNeoWav(input, rate); expect(wav.length).toBe(32044);
    expect(validateNeoWav(Buffer.from(wav))).toMatchObject({ seconds: 1 });
    expect(Buffer.from(neoBase64(wav), 'base64')).toEqual(Buffer.from(wav));
  });
  it('bounds invalid amplitudes and rejects oversized or nonaudio inputs', () => {
    const pcm = new Float32Array(16000); pcm.set([NaN, Infinity, 50, -50]); const wav = encodeNeoWav(pcm, 16000), view = new DataView(wav.buffer);
    expect(view.getInt16(44, true)).toBe(0); expect(view.getInt16(48, true)).toBe(32767); expect(view.getInt16(50, true)).toBe(-32767);
    expect(() => encodeNeoWav(new Float32Array(16000 * 13), 16000)).toThrow(); expect(() => validateNeoWav(Buffer.from('not a wav'))).toThrow();
  });
  it('rejects forged RIFF lengths, unsupported channels and trailing bytes', () => {
    const original = Buffer.from(encodeNeoWav(new Float32Array(16000), 16000));
    const size = Buffer.from(original); size.writeUInt32LE(1, 4); expect(() => validateNeoWav(size)).toThrow();
    const stereo = Buffer.from(original); stereo.writeUInt16LE(2, 22); expect(() => validateNeoWav(stereo)).toThrow();
    const tail = Buffer.concat([original, Buffer.from([0])]); tail.writeUInt32LE(tail.length - 8, 4); expect(() => validateNeoWav(tail)).toThrow();
  });
});
