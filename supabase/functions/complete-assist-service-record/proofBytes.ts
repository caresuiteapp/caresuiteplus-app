export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}
export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return 'sha256:' + [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function signatureImageKind(bytes: Uint8Array): 'png' | 'jpeg' {
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error('Signaturbild zu groß oder leer.');
  if ([137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n)) {
    if (bytes.length < 24) throw new Error('Signaturbild unvollständig.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const w = view.getUint32(16), h = view.getUint32(20);
    if (!w || !h || w > 4096 || h > 4096 || w * h > 4_000_000) throw new Error('Signaturbild-Abmessungen ungültig.');
    return 'png';
  }
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpeg';
  throw new Error('Nur ursprüngliche PNG-/JPEG-Signaturen werden akzeptiert.');
}
export async function verifyOriginalSignature(bytes: Uint8Array, expectedHash: string): Promise<'png' | 'jpeg'> {
  const kind = signatureImageKind(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192));
  const dataUrl = `data:image/${kind};base64,${btoa(binary)}`;
  const actual = await hashBytes(new TextEncoder().encode(dataUrl));
  if (actual !== expectedHash) throw new Error('Die Originalsignatur stimmt nicht mit der gespeicherten Fassung überein.');
  return kind;
}
export function requireSignaturePath(path: unknown, tenant: string, visit: string): string {
  const prefix = `tenant/${tenant}/assist/visits/${visit}/signatures/`;
  if (typeof path !== 'string' || !path.startsWith(prefix) || !/^[0-9a-f-]{36}\.png$/.test(path.slice(prefix.length))) {
    throw new Error('Signaturpfad gehört nicht zur bestätigten Einsatzfassung.');
  }
  return path;
}
