import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  normalizeEmployeePortalPickedMedia,
  type EmployeePortalPickedMedia,
} from '@/lib/portal/employeePortalMediaValidation';

export type EmployeePortalMediaPickerResult =
  | { ok: true; media: EmployeePortalPickedMedia | null }
  | { ok: false; error: string; settingsRequired?: boolean; permissionHelp?: string };

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
    permissionHelp: !canAskAgain
      ? 'Android/iOS: Einstellungen → Apps → CareSuite → Berechtigungen → Kamera → Zulassen. Danach CareSuite vollständig schließen und erneut öffnen.'
      : undefined,
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

function browserCameraError(error: unknown): EmployeePortalMediaPickerResult {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return { ok: false, error: 'Der Browser hat keine verwendbare Kamera gefunden.' };
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return {
      ok: false,
      error: 'Die Kamera wird gerade von einer anderen App oder einem anderen Browser-Tab verwendet.',
      permissionHelp: 'Andere Kamera-Apps schließen und diese Seite danach neu laden.',
    };
  }
  return {
    ok: false,
    error: 'Der Browser darf nicht auf die Kamera zugreifen.',
    settingsRequired: true,
    permissionHelp:
      'Chrome/Edge: Schloss- oder Regler-Symbol neben der Adresse → Website-Einstellungen → Kamera → Zulassen. Safari: „aA“ → Website-Einstellungen → Kamera → Erlauben. Danach die Seite neu laden.',
  };
}

async function openEmployeePortalBrowserCamera(): Promise<EmployeePortalMediaPickerResult> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { ok: false, error: 'Die Kamera ist in dieser Browseransicht nicht verfügbar.' };
  }
  if (!window.isSecureContext) {
    return {
      ok: false,
      error: 'Die Kamera ist nur über eine sichere HTTPS-Verbindung verfügbar.',
      permissionHelp: 'Bitte das Mitarbeiterportal über die offizielle https://-Adresse öffnen.',
    };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      error: 'Dieser Browser unterstützt den direkten Kamerazugriff nicht.',
      permissionHelp:
        'Bitte das Portal direkt in einer aktuellen Version von Chrome, Edge oder Safari öffnen – nicht im integrierten Browser von WhatsApp oder einer anderen App. Ein vorhandenes Foto kann weiterhin über „Galerie“ hochgeladen werden.',
    };
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    });
  } catch (error) {
    return browserCameraError(error);
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    const panel = document.createElement('div');
    const title = document.createElement('strong');
    const hint = document.createElement('span');
    const video = document.createElement('video');
    const actions = document.createElement('div');
    const cancel = document.createElement('button');
    const capture = document.createElement('button');

    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Kameraaufnahme');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: 'rgba(2, 8, 23, 0.92)',
    });
    Object.assign(panel.style, {
      width: 'min(720px, 100%)',
      maxHeight: '100%',
      overflow: 'auto',
      padding: '16px',
      border: '2px solid #38BDF8',
      borderRadius: '18px',
      background: '#081A33',
      color: '#FFFFFF',
      boxShadow: '0 24px 80px rgba(0,0,0,.55)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    });
    title.textContent = 'Kamera ist bereit';
    Object.assign(title.style, { fontSize: '22px', lineHeight: '1.3' });
    hint.textContent =
      'Motiv vollständig im Bild ausrichten und anschließend „Foto aufnehmen“ wählen.';
    Object.assign(hint.style, { fontSize: '15px', lineHeight: '1.45', color: '#D6E7FA' });
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    Object.assign(video.style, {
      width: '100%',
      maxHeight: '70vh',
      objectFit: 'contain',
      borderRadius: '12px',
      background: '#000000',
    });
    Object.assign(actions.style, { display: 'flex', flexWrap: 'wrap', gap: '10px' });
    cancel.type = 'button';
    cancel.textContent = 'Abbrechen';
    capture.type = 'button';
    capture.textContent = 'Foto aufnehmen';
    for (const button of [cancel, capture]) {
      Object.assign(button.style, {
        minHeight: '48px',
        flex: '1 1 180px',
        padding: '10px 18px',
        borderRadius: '12px',
        border: '1px solid #7DD3FC',
        fontSize: '16px',
        fontWeight: '700',
        cursor: 'pointer',
      });
    }
    Object.assign(cancel.style, { color: '#E6F3FF', background: '#12304F' });
    Object.assign(capture.style, { color: '#03111F', background: '#7DD3FC' });

    const cleanup = () => {
      stream.getTracks().forEach((track) => track.stop());
      overlay.remove();
    };
    cancel.onclick = () => {
      cleanup();
      resolve({ ok: true, media: null });
    };
    capture.onclick = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(video, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            cleanup();
            resolve({ ok: false, error: 'Das Kamerabild konnte nicht übernommen werden.' });
            return;
          }
          const uri = URL.createObjectURL(blob);
          cleanup();
          resolve({
            ok: true,
            media: normalizeEmployeePortalPickedMedia({
              uri,
              fileName: `kamera-${Date.now()}.jpg`,
              mimeType: 'image/jpeg',
              sizeBytes: blob.size,
              reportedKind: 'image',
            }),
          });
        },
        'image/jpeg',
        0.9,
      );
    };

    actions.append(cancel, capture);
    panel.append(title, hint, video, actions);
    overlay.append(panel);
    document.body.append(overlay);
    void video.play().catch((error) => {
      cleanup();
      resolve(browserCameraError(error));
    });
  });
}

export async function openEmployeePortalCamera(): Promise<EmployeePortalMediaPickerResult> {
  try {
    if (Platform.OS === 'web') return openEmployeePortalBrowserCamera();
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return cameraPermissionError(permission.canAskAgain);

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
    const permissionBlocked = /permission|notallowed|denied|security|camera.*access|camera.*unavailable/i.test(message);
    return {
      ok: false,
      error: permissionBlocked
        ? 'Kamerazugriff wurde blockiert. Bitte prüfen Sie die Berechtigung in den Browser- oder Geräteeinstellungen.'
        : 'Die Kamera konnte nicht geöffnet werden. Bitte versuchen Sie es erneut.',
      settingsRequired: permissionBlocked,
      permissionHelp: Platform.OS === 'web'
        ? 'Browser: Links neben der Internetadresse auf das Schloss-/Kamerasymbol tippen, Kamera auf „Zulassen“ stellen und die Seite neu laden. Alternativ kann das Foto sofort über „Galerie“ oder „Datei“ hochgeladen werden.'
        : 'Android/iOS: Einstellungen → Apps → CareSuite → Berechtigungen → Kamera → Zulassen. Danach CareSuite vollständig schließen und erneut öffnen.',
    };
  }
}

/**
 * Android may destroy MainActivity while the system camera is open. Expo keeps
 * that result separately; reading it on the restored screen prevents a taken
 * photo from disappearing before upload.
 */
export async function recoverEmployeePortalPendingCameraMedia(): Promise<EmployeePortalMediaPickerResult> {
  if (Platform.OS !== 'android') return { ok: true, media: null };
  try {
    const pending = await ImagePicker.getPendingResultAsync();
    if (!pending) return { ok: true, media: null };
    if ('code' in pending) {
      return {
        ok: false,
        error: pending.message || 'Die vorherige Kameraaufnahme konnte nicht wiederhergestellt werden.',
      };
    }
    return fromImagePickerResult(pending, 'kamera-wiederhergestellt');
  } catch {
    return { ok: false, error: 'Die vorherige Kameraaufnahme konnte nicht wiederhergestellt werden.' };
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

export function releaseEmployeePortalMediaUri(uri: string | null | undefined): void {
  if (Platform.OS === 'web' && uri?.startsWith('blob:')) URL.revokeObjectURL(uri);
}
