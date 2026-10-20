import { Platform } from 'react-native';

export async function readEmployeePortalMediaBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS !== 'web' && /^(file|content):\/\//i.test(uri)) {
    const { File } = await import('expo-file-system');
    const bytes = new Uint8Array(await new File(uri).arrayBuffer());
    if (!bytes.length) throw new Error('Die ausgewählte Datei ist leer.');
    return bytes;
  }
  // Do not revoke a web blob here. Upload may fail temporarily and the exact
  // same selection must remain retryable without reopening camera/gallery.
  const response = await fetch(uri);
  if (!response.ok && response.status !== 0) {
    throw new Error(`Datei konnte nicht gelesen werden (${response.status}).`);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength <= 0) throw new Error('Die ausgewählte Datei ist leer.');
  return new Uint8Array(buffer);
}

