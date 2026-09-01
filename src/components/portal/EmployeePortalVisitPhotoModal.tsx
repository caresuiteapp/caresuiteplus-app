import { useCallback, useMemo, useState } from 'react';
import { Image, Linking, Platform, StyleSheet, Text, View } from 'react-native';
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
import {
  openEmployeePortalCamera,
  openEmployeePortalDocumentPicker,
  openEmployeePortalMediaLibrary,
  readEmployeePortalMediaBytes,
  releaseEmployeePortalMediaUri,
  type EmployeePortalMediaPickerResult,
} from '@/lib/portal/employeePortalMediaPicker';
import {
  formatEmployeePortalMediaSize,
  validateEmployeePortalPickedMedia,
  type EmployeePortalPickedMedia,
} from '@/lib/portal/employeePortalMediaValidation';

type EmployeePortalVisitPhotoModalProps = {
  visible: boolean;
  tenantId: string | null;
  visitId: string | null;
  employeeId: string | null;
  existingReferences: string[];
  onClose: () => void;
  onUploaded: (storagePaths: string[]) => void;
};

export function EmployeePortalVisitPhotoModal({
  visible,
  tenantId,
  visitId,
  employeeId,
  existingReferences,
  onClose,
  onUploaded,
}: EmployeePortalVisitPhotoModalProps) {
  const text = employeePortalExecutionText;
  const deviceClass = useDeviceClass();
  const isMobile = !isDesktopClass(deviceClass);
  const [picked, setPicked] = useState<EmployeePortalPickedMedia | null>(null);
  const [picking, setPicking] = useState(false);
  const [settingsRequired, setSettingsRequired] = useState(false);
  const [permissionHelp, setPermissionHelp] = useState<string | null>(null);
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
        pickerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        pickerAction: { flexGrow: 1, minWidth: 190 },
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
        permissionHelp: {
          ...typography.caption,
          color: '#7C2D12',
          backgroundColor: '#FFF7ED',
          borderColor: '#FDBA74',
          borderWidth: 1,
          borderRadius: 10,
          padding: spacing.sm,
          lineHeight: 18,
        },
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
    setPicking(false);
    setSettingsRequired(false);
    setPermissionHelp(null);
  }, []);

  const handleClose = () => {
    releaseEmployeePortalMediaUri(picked?.uri);
    reset();
    onClose();
  };

  const acceptPickerResult = (result: EmployeePortalMediaPickerResult): EmployeePortalPickedMedia | null => {
    setPicking(false);
    if (!result.ok) {
      setError(result.error);
      setSettingsRequired(Boolean(result.settingsRequired));
      setPermissionHelp(result.permissionHelp ?? null);
      return null;
    }
    if (!result.media) return null;
    const validation = validateEmployeePortalPickedMedia(result.media, 'visit');
    if (!validation.ok) {
      setError(validation.error);
      return null;
    }
    setError(null);
    setSettingsRequired(false);
    setPermissionHelp(null);
    if (picked?.uri && picked.uri !== result.media.uri) releaseEmployeePortalMediaUri(picked.uri);
    setPicked(result.media);
    return result.media;
  };

  const handleUpload = async (selectedMedia?: EmployeePortalPickedMedia) => {
    const media = selectedMedia ?? picked;
    if (!media || !tenantId || !visitId || !employeeId) {
      setError('Foto konnte nicht zugeordnet werden.');
      return;
    }
    setUploading(true);
    setError(null);
    let bytes: Uint8Array;
    try {
      bytes = await readEmployeePortalMediaBytes(media.uri);
    } catch {
      setUploading(false);
      setError('Die ausgewählte Datei konnte nicht gelesen werden. Bitte wählen Sie sie erneut aus.');
      return;
    }
    const validation = validateEmployeePortalPickedMedia(
      { ...media, sizeBytes: bytes.length },
      'visit',
    );
    if (!validation.ok) {
      setUploading(false);
      setError(validation.error);
      return;
    }
    const result = await uploadEmployeePortalVisitAttachment({
      tenantId,
      visitId,
      employeeId,
      fileName: media.fileName,
      mimeType: media.mimeType,
      bytes,
    });
    setUploading(false);
    if (!result.ok) {
      setError(result.error ?? 'Foto konnte nicht gespeichert werden.');
      return;
    }
    releaseEmployeePortalMediaUri(media.uri);
    onUploaded([...existingReferences, result.data.storagePath]);
    handleClose();
  };

  const handlePick = async (source: 'camera' | 'library' | 'document') => {
    setError(null);
    setPicking(true);
    const result =
      source === 'camera'
        ? await openEmployeePortalCamera()
        : source === 'library'
          ? await openEmployeePortalMediaLibrary()
          : await openEmployeePortalDocumentPicker({ includeMediaFallback: true });
    const acceptedMedia = acceptPickerResult(result);
    if (acceptedMedia) await handleUpload(acceptedMedia);
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
          <View style={styles.pickerActions}>
            <View style={styles.pickerAction}>
              <PremiumButton
                title="📷 Kamera öffnen"
                onPress={() => void handlePick('camera')}
                disabled={picking || uploading}
              />
            </View>
            <View style={styles.pickerAction}>
              <PremiumButton
                title="🖼️ Galerie öffnen"
                variant="secondary"
                onPress={() => void handlePick('library')}
                disabled={picking || uploading}
              />
            </View>
          </View>
          <PremiumButton
            title="📎 Datei, Foto oder Video vom Gerät auswählen"
            variant="secondary"
            onPress={() => void handlePick('document')}
            disabled={picking || uploading}
          />
          {picked ? (
            <>
              <View style={styles.pickedCard}>
                <Text style={styles.heroTitle} numberOfLines={2}>{picked.fileName}</Text>
                <Text style={styles.meta}>
                  {picked.kind === 'image' ? 'Foto' : picked.kind === 'video' ? 'Video' : 'PDF/Dokument'} · {formatEmployeePortalMediaSize(picked.sizeBytes)}
                </Text>
              </View>
              {error ? (
                <PremiumButton title="Speichern erneut versuchen" loading={uploading} onPress={() => void handleUpload()} />
              ) : (
                <Text style={styles.meta}>Die Datei wird sofort dauerhaft gespeichert…</Text>
              )}
            </>
          ) : null}
          {settingsRequired && Platform.OS !== 'web' ? (
            <PremiumButton
              title="Geräteeinstellungen öffnen"
              size="sm"
              variant="secondary"
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
          {permissionHelp ? <Text style={styles.permissionHelp}>{permissionHelp}</Text> : null}
          {settingsRequired ? (
            <Text style={styles.meta}>
              Du kannst sofort weiterarbeiten: Nutze „Datei, Foto oder Video vom Gerät auswählen“ – dafür ist kein direkter Kamerazugriff nötig.
            </Text>
          ) : null}
          {settingsRequired && Platform.OS === 'web' ? (
            <PremiumButton
              title="Seite nach Freigabe neu laden"
              size="sm"
              variant="secondary"
              onPress={() => globalThis.location?.reload()}
            />
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
