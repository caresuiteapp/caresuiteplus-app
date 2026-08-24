import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  normalizeEmployeePortalPickedMedia,
  type EmployeePortalPickedMedia,
} from '@/lib/portal/employeePortalMediaValidation';

export type EmployeePortalMediaPickerResult =
  | { ok: true; media: EmployeePortalPickedMedia | null }
  | { ok: false; error: string; settingsRequired?: boolean };

const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

function cameraPermissionError(canAskAgain: boolean): EmployeePortalMediaPickerResult {
  return {
    ok: false,
    error: canAskAgain
      ? 'Kamerazugriff wurde nicht erlaubt. Bitte erteilen Sie die Berechtigung und versuchen Sie es erneut.'
      : 'Kamerazugriff ist dauerhaft gesperrt. Bitte erlauben Sie CareSuite den Zugriff in den Geräte- oder Browser-Einstellungen.',
    settingsRequired: !canAskAgain,
  };
}

function libraryPermissionError(canAskAgain: boolean): EmployeePortalMediaPickerResult {
  return {
    ok: false,
    error: canAskAgain
      ? 'Zugriff auf Fotos und Videos wurde nicht erlaubt.'
      : 'Der Zugriff auf Fotos und Videos ist dauerhaft gesperrt. Bitte ändern Sie die Berechtigung in den Geräteeinstellungen.',
    settingsRequired: !canAskAgain,
  };
}

function fromImagePickerResult(
  result: ImagePicker.ImagePickerResult,
  prefix: string,
): EmployeePortalMediaPickerResult {
  if (result.canceled || !result.assets?.[0]) return { ok: true, media: null };
  const asset = result.assets[0];
  return {
    ok: true,
    media: normalizeEmployeePortalPickedMedia({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      sizeBytes: asset.fileSize,
      reportedKind: asset.type,
      prefix,
    }),
  };
}

export async function openEmployeePortalCamera(): Promise<EmployeePortalMediaPickerResult> {
  try {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return cameraPermissionError(permission.canAskAgain);
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.85,
      videoMaxDuration: 60,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });
    return fromImagePickerResult(result, 'kamera');
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return {
      ok: false,
      error: /permission|notallowed|denied/i.test(message)
        ? 'Kamerazugriff wurde blockiert. Bitte prüfen Sie die Berechtigung in den Browser- oder Geräteeinstellungen.'
        : 'Die Kamera konnte nicht geöffnet werden. Bitte versuchen Sie es erneut.',
      settingsRequired: /permission|notallowed|denied/i.test(message),
    };
  }
}

export async function openEmployeePortalMediaLibrary(): Promise<EmployeePortalMediaPickerResult> {
  try {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return libraryPermissionError(permission.canAskAgain);
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.85,
      selectionLimit: 1,
    });
    return fromImagePickerResult(result, 'mediathek');
  } catch {
    return { ok: false, error: 'Fotos und Videos konnten nicht geöffnet werden.' };
  }
}

export async function openEmployeePortalDocumentPicker(options?: {
  includeMediaFallback?: boolean;
}): Promise<EmployeePortalMediaPickerResult> {
  try {
    const types = options?.includeMediaFallback
      ? [...DOCUMENT_MIME_TYPES, 'image/*', 'video/*']
      : [...DOCUMENT_MIME_TYPES];
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: types,
    });
    if (result.canceled || !result.assets?.[0]) return { ok: true, media: null };
    const asset = result.assets[0];
    return {
      ok: true,
      media: normalizeEmployeePortalPickedMedia({
        uri: asset.uri,
        fileName: asset.name,
        mimeType: asset.mimeType,
        sizeBytes: asset.size,
        prefix: 'datei',
      }),
    };
  } catch {
    return { ok: false, error: 'Die Dateiauswahl konnte nicht geöffnet werden.' };
  }
}

export async function readEmployeePortalMediaBytes(uri: string): Promise<Uint8Array> {
  const response = await fetch(uri);
  if (!response.ok && response.status !== 0) {
    throw new Error(`Datei konnte nicht gelesen werden (${response.status}).`);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength <= 0) throw new Error('Die ausgewählte Datei ist leer.');
  return new Uint8Array(buffer);
}
