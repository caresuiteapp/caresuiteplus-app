import { useCallback, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { PremiumButton } from '@/components/ui';
import { uploadEmployeePortalVisitAttachment } from '@/lib/portal/employeePortalVisitAttachmentService';
import {
  employeePortalExecutionSurface,
  employeePortalExecutionText,
} from '@/lib/portal/employeePortalExecutionSurface';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { spacing, typography } from '@/theme';

type PickedMedia = {
  uri: string;
  fileName: string;
  mimeType: string;
  size: number | null;
  kind: 'image' | 'video' | 'document';
};

const IMAGE_LIMIT_BYTES = 15 * 1024 * 1024;
const VIDEO_LIMIT_BYTES = 50 * 1024 * 1024;

function resolveMediaKind(mimeType: string): PickedMedia['kind'] {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return 'document';
}

function formatFileSize(size: number | null): string {
  if (!size) return 'Größe unbekannt';
  return `${(size / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

type EmployeePortalVisitPhotoModalProps = {
  visible: boolean;
  tenantId: string | null;
  visitId: string | null;
  existingReferences: string[];
  onClose: () => void;
  onUploaded: (storagePaths: string[]) => void;
};

async function readPhotoBytes(uri: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(uri);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

export function EmployeePortalVisitPhotoModal({
  visible,
  tenantId,
  visitId,
  existingReferences,
  onClose,
  onUploaded,
}: EmployeePortalVisitPhotoModalProps) {
  const text = employeePortalExecutionText;
  const deviceClass = useDeviceClass();
  const isMobile = !isDesktopClass(deviceClass);
  const [picked, setPicked] = useState<PickedMedia | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { gap: spacing.sm },
        hero: {
          padding: spacing.md,
          gap: spacing.xs,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(139, 92, 246, 0.38)',
          backgroundColor: 'rgba(139, 92, 246, 0.10)',
        },
        heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
        heroIcon: {
          width: 46,
          height: 46,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#7C3AED',
        },
        heroTitle: { ...typography.bodyStrong, color: text.primary },
        heroText: { ...typography.caption, color: text.secondary },
        preview: {
          width: '100%',
          height: 180,
          borderRadius: 10,
          backgroundColor: employeePortalExecutionSurface.subtleBackground,
          borderWidth: 1,
          borderColor: employeePortalExecutionSurface.border,
        },
        meta: { ...typography.caption, color: text.muted },
        pickedCard: {
          padding: spacing.sm,
          gap: 4,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: employeePortalExecutionSurface.borderStrong,
          backgroundColor: employeePortalExecutionSurface.subtleBackground,
        },
        error: { ...typography.caption, color: '#EF4444' },
        list: { gap: spacing.xs },
        listItem: { ...typography.caption, color: text.secondary },
        modalSheet: { backgroundColor: employeePortalExecutionSurface.background },
        modalBody: { backgroundColor: employeePortalExecutionSurface.background },
      }),
    [text],
  );

  const reset = useCallback(() => {
    setPicked(null);
    setError(null);
    setUploading(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePick = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['image/*', 'video/*', 'application/pdf'],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'application/octet-stream';
    const kind = resolveMediaKind(mimeType);
    const size = asset.size ?? null;
    const limit = kind === 'video' ? VIDEO_LIMIT_BYTES : IMAGE_LIMIT_BYTES;
    if (size && size > limit) {
      setError(
        kind === 'video'
          ? 'Das Video ist größer als 50 MB. Bitte kürzen oder komprimieren.'
          : 'Die Datei ist größer als 15 MB. Bitte verkleinern.',
      );
      return;
    }
    setPicked({
      uri: asset.uri,
      fileName: asset.name ?? `einsatz-medium-${Date.now()}`,
      mimeType,
      size,
      kind,
    });
  };

  const handleUpload = async () => {
    if (!picked || !tenantId || !visitId) {
      setError('Foto konnte nicht zugeordnet werden.');
      return;
    }
    setUploading(true);
    setError(null);
    const bytes = await readPhotoBytes(picked.uri);
    if (!bytes) {
      setUploading(false);
      setError('Foto konnte nicht gelesen werden.');
      return;
    }
    const result = await uploadEmployeePortalVisitAttachment({
      tenantId,
      visitId,
      fileName: picked.fileName,
      mimeType: picked.mimeType,
      bytes,
    });
    setUploading(false);
    if (!result.ok) {
      setError(result.error ?? 'Foto konnte nicht gespeichert werden.');
      return;
    }
    onUploaded([...existingReferences, result.data.storagePath]);
    handleClose();
  };

  return (
    <PlatformModal
      visible={visible}
      title="Foto, Video oder Dokument"
      subtitle="Interne Einsatzmedien sicher hinzufügen"
      onClose={handleClose}
      variant={isMobile ? 'bottomSheet' : 'center'}
      animationType={isMobile ? 'slide' : 'fade'}
      maxWidth={520}
      sheetStyle={styles.modalSheet}
      bodyStyle={styles.modalBody}
    >
      <View style={styles.body}>
          <View style={styles.hero}>
            <View style={styles.heroRow}>
              <View style={styles.heroIcon}>
                <Ionicons name="images-outline" size={25} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.heroTitle}>Medien zum Einsatz</Text>
                <Text style={styles.heroText}>Fotos, Videos und PDF-Dokumente werden intern gespeichert.</Text>
              </View>
            </View>
            <Text style={styles.heroText}>
              Sie erscheinen nicht automatisch im Leistungsnachweis oder Klient:innenportal.
            </Text>
          </View>
          {picked?.kind === 'image' ? (
            <Image source={{ uri: picked.uri }} style={styles.preview} resizeMode="cover" />
          ) : null}
          <PremiumButton title="Foto, Video oder PDF auswählen" onPress={() => void handlePick()} />
          {picked ? (
            <>
              <View style={styles.pickedCard}>
                <Text style={styles.heroTitle} numberOfLines={2}>{picked.fileName}</Text>
                <Text style={styles.meta}>
                  {picked.kind === 'image' ? 'Foto' : picked.kind === 'video' ? 'Video' : 'PDF/Dokument'} · {formatFileSize(picked.size)}
                </Text>
              </View>
              <PremiumButton title="Intern am Einsatz speichern" loading={uploading} onPress={() => void handleUpload()} />
            </>
          ) : null}
          {existingReferences.length > 0 ? (
            <View style={styles.list}>
              <Text style={styles.meta}>Bereits intern hinzugefügt: {existingReferences.length}</Text>
              {existingReferences.slice(-3).map((ref) => (
                <Text key={ref} style={styles.listItem} numberOfLines={1}>
                  · {ref.split('/').pop()}
                </Text>
              ))}
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </PlatformModal>
  );
}
