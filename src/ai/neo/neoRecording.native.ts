import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { decodeNeoPcmRecording } from './neoRecordingAudio';
export async function readNeoRecording(signal: AbortSignal) {
  const selected = await getDocumentAsync({ type: ['audio/wav', 'audio/x-wav'], copyToCacheDirectory: true, multiple: false });
  if (selected.canceled || !selected.assets[0]) return null;
  const asset = selected.assets[0], file = new File(asset.uri);
  try { signal.throwIfAborted(); if (file.size > 30 * 1024 * 1024) throw Error('Bitte eine Aufnahme bis 30 MB wählen.'); const bytes = await file.bytes(); signal.throwIfAborted(); return decodeNeoPcmRecording(bytes); }
  finally { try { if (file.exists) file.delete(); } catch {} }
}
