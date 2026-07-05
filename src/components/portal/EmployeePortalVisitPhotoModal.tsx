import { useCallback, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
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

type PickedPhoto = {
  uri: string;
  fileName: string;
  mimeType: string;
  previewUri: string;
};

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
  const [picked, setPicked] = useState<PickedPhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { gap: spacing.sm },
        preview: {
          width: '100%',
          height: 180,
          borderRadius: 10,
          backgroundColor: employeePortalExecutionSurface.subtleBackground,
          borderWidth: 1,
          borderColor: employeePortalExecutionSurface.border,
        },
        meta: { ...typography.caption, color: text.muted },
        error: { ...typography.caption, color: '#EF4444' },
        list: { gap: spacing.xs },
        listItem: { ...typography.caption, color: text.secondary },
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
      type: ['image/*'],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPicked({
      uri: asset.uri,
      fileName: asset.name ?? `foto-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      previewUri: asset.uri,
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
      title="Foto / Anhang"
      subtitle="Bild zum Einsatz hinzufügen"
      onClose={handleClose}
      variant={isMobile ? 'bottomSheet' : 'center'}
      animationType={isMobile ? 'slide' : 'fade'}
      maxWidth={520}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          {picked ? <Image source={{ uri: picked.previewUri }} style={styles.preview} resizeMode="cover" /> : null}
          <PremiumButton title="Foto auswählen" variant="secondary" onPress={() => void handlePick()} />
          {picked ? (
            <>
              <Text style={styles.meta}>{picked.fileName}</Text>
              <PremiumButton title="Foto speichern" loading={uploading} onPress={() => void handleUpload()} />
            </>
          ) : null}
          {existingReferences.length > 0 ? (
            <View style={styles.list}>
              <Text style={styles.meta}>Bereits hinzugefügt: {existingReferences.length}</Text>
              {existingReferences.slice(-3).map((ref) => (
                <Text key={ref} style={styles.listItem} numberOfLines={1}>
                  · {ref.split('/').pop()}
                </Text>
              ))}
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>
    </PlatformModal>
  );
}
