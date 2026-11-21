export function encodeNeoWav(input: Float32Array, sourceRate: number): Uint8Array {
  if (!Number.isFinite(sourceRate) || sourceRate < 8000 || sourceRate > 192000 || !input.length || input.length / sourceRate > 12.1) throw Error('Ungültiger Audioabschnitt.');
  const rate = 16000, length = Math.floor(input.length * rate / sourceRate);
  const bytes = new Uint8Array(44 + length * 2), view = new DataView(bytes.buffer);
  const label = (at: number, text: string) => { for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i); };
  label(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); label(8, 'WAVE'); label(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); label(36, 'data'); view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) {
    const start = i * sourceRate / rate, end = (i + 1) * sourceRate / rate;
    let total = 0, weight = 0;
    for (let n = Math.floor(start); n < Math.ceil(end) && n < input.length; n++) { const part = Math.min(end, n + 1) - Math.max(start, n); total += (Number.isFinite(input[n]) ? input[n] : 0) * part; weight += part; }
    view.setInt16(44 + 2 * i, Math.round(Math.max(-1, Math.min(1, total / Math.max(weight, 1e-9))) * 32767), true);
  }
  return bytes;
}
export function neoBase64(bytes: Uint8Array): string {
  let text = ''; for (let offset = 0; offset < bytes.length; offset += 8192) text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(text);
}
