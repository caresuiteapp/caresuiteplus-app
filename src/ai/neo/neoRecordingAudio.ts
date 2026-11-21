export type NeoRecordingAudio = { samples: Float32Array; rate: number };
export function decodeNeoPcmRecording(bytes: Uint8Array): NeoRecordingAudio {
  if (bytes.length < 44 || bytes.length > 30 * 1024 * 1024) throw Error('Bitte eine WAV-Aufnahme bis 30 MB wählen.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), text = (offset: number, size: number) => String.fromCharCode(...bytes.subarray(offset, offset + size));
  if (text(0, 4) !== 'RIFF' || text(8, 4) !== 'WAVE' || view.getUint32(4, true) + 8 !== bytes.length) throw Error('Diese App unterstützt hier WAV mit 16-Bit-PCM. Andere Audioformate können im Web eingelesen werden.');
  let channels = 0, rate = 0, format = 0, bits = 0, data: Uint8Array | null = null, offset = 12;
  for (; offset + 8 <= bytes.length;) {
    const kind = text(offset, 4), length = view.getUint32(offset + 4, true), start = offset + 8;
    if (start + length > bytes.length) throw Error('Die Audiodatei ist unvollständig.');
    if (kind === 'fmt ') { if (length < 16 || format) throw Error('Ungültiges WAV-Format.'); format = view.getUint16(start, true); channels = view.getUint16(start + 2, true); rate = view.getUint32(start + 4, true); bits = view.getUint16(start + 14, true); }
    if (kind === 'data') { if (data) throw Error('Die WAV-Datei enthält mehrere Tonspuren.'); data = bytes.subarray(start, start + length); }
    offset = start + length + length % 2;
  }
  if (offset !== bytes.length || format !== 1 || bits !== 16 || ![1, 2].includes(channels) || rate < 8000 || rate > 96000 || !data || data.length % (channels * 2)) throw Error('Bitte WAV mit 16-Bit-PCM und einer oder zwei Tonspuren wählen.');
  const length = data.length / channels / 2; if (!length || length / rate > 1800) throw Error('Bitte Aufnahmen bis 30 Minuten abschnittsweise einlesen.');
  const input = new DataView(data.buffer, data.byteOffset, data.byteLength), samples = new Float32Array(length);
  for (let i = 0; i < length; i++) { let sum = 0; for (let c = 0; c < channels; c++) sum += input.getInt16((i * channels + c) * 2, true) / 32768; samples[i] = sum / channels; }
  return { samples, rate };
}
