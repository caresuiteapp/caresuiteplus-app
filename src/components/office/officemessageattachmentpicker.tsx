import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { auroraGlass, darkGlassSurfaceText, surfaceContrastText } from '@/design/tokens/auroraGlass';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';
import {
  isImageMimeType,
  isPdfMimeType,
  isAudioMimeType,
  isVideoMimeType,
  validateMessageAttachment,
  type PendingMessageAttachment,
} from '@/lib/office/messageattachmentvalidation';
import { VoicePendingPreview } from '@/components/office/voicependingpreview';
import {
  openEmployeePortalCamera,
  openEmployeePortalDocumentPicker,
  openEmployeePortalMediaLibrary,
  readEmployeePortalMediaBytes,
  type EmployeePortalMediaPickerResult,
} from '@/lib/portal/employeePortalMediaPicker';
import type { EmployeePortalPickedMedia } from '@/lib/portal/employeePortalMediaValidation';

type OfficeMessageAttachmentPickerProps = {
  attachments: PendingMessageAttachment[];
  onChange: (attachments: PendingMessageAttachment[]) => void;
  disabled?: boolean;
  error?: string | null;
  onError?: (message: string | null) => void;
  onDarkSurface?: boolean;
  compact?: boolean;
};

function createAttachmentId(): string {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `att-pending-${Date.now()}`;
}

function attachmentIcon(mimeType: string): string {
  if (isImageMimeType(mimeType)) return '🖼️';
  if (isPdfMimeType(mimeType)) return '📄';
  if (isAudioMimeType(mimeType)) return '🎤';
  if (isVideoMimeType(mimeType)) return '🎬';
  return '📎';
}

export function OfficeMessageAttachmentPicker({
  attachments,
  onChange,
  disabled,
  error,
  onError,
  onDarkSurface = false,
  compact = false,
}: OfficeMessageAttachmentPickerProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const ink = onDarkSurface ? darkGlassSurfaceText : surfaceContrastText(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { gap: spacing.xs, alignSelf: 'flex-start', maxWidth: '100%' },
        pickerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
        compactButton: {
          minHeight: 36,
          width: 36,
          paddingHorizontal: 0,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: onDarkSurface ? auroraGlass.chip : c.surface,
          borderWidth: 1,
          borderColor: onDarkSurface ? auroraGlass.border : c.border,
        },
        compactButtonText: { ...typography.caption, color: ink.primary, fontWeight: '700' },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        attachmentBlock: {
          gap: spacing.xs,
          padding: spacing.sm,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: onDarkSurface ? auroraGlass.border : c.border,
          backgroundColor: onDarkSurface ? auroraGlass.chip : `${c.violet}08`,
        },
        name: { ...typography.caption, color: ink.primary, flex: 1, fontWeight: '600' },
        meta: { ...typography.caption, color: ink.muted },
        remove: {
          ...typography.caption,
          color: onDarkSurface ? darkGlassSurfaceText.secondary : c.violet,
          fontWeight: '700',
        },
        error: { ...typography.caption, color: '#c0392b' },
      }),
    [c, ink, onDarkSurface, typography],
  );

  const appendPickedMedia = async (media: EmployeePortalPickedMedia) => {
    onError?.(null);
    const fileName = media.fileName;
    const mimeType = media.mimeType;
    const fileSizeBytes = media.sizeBytes ?? 0;

    if (fileSizeBytes > 0) {
      const validation = validateMessageAttachment({ fileName, mimeType, fileSizeBytes });
      if (!validation.ok) {
        onError?.(validation.error);
        return;
      }
    }

    try {
      const fileData = await readEmployeePortalMediaBytes(media.uri);
      const validated = validateMessageAttachment({
        fileName,
        mimeType,
        fileSizeBytes: fileSizeBytes || fileData.length,
      });
      if (!validated.ok) {
        onError?.(validated.error);
        return;
      }

      onChange([
        ...attachments,
        {
          id: createAttachmentId(),
          fileName,
          mimeType,
          fileSizeBytes: fileSizeBytes || fileData.length,
          fileData,
        },
      ]);
    } catch {
      onError?.('Datei konnte nicht gelesen werden.');
    }
  };

  const handlePickerResult = async (result: EmployeePortalMediaPickerResult) => {
    if (!result.ok) {
      onError?.(result.error);
      return;
    }
    if (result.media) await appendPickedMedia(result.media);
  };

  const pickAttachment = async (source: 'camera' | 'library' | 'document') => {
    onError?.(null);
    const result =
      source === 'camera'
        ? await openEmployeePortalCamera()
        : source === 'library'
          ? await openEmployeePortalMediaLibrary()
          : await openEmployeePortalDocumentPicker({ includeMediaFallback: true });
    await handlePickerResult(result);
  };

  const removeAttachment = (id: string) => {
    onChange(attachments.filter((item) => item.id !== id));
  };

  return (
    <View style={styles.root}>
      {attachments.map((attachment) => (
        <View key={attachment.id} style={styles.attachmentBlock}>
          <View style={styles.row}>
            <Text style={styles.name}>
              {attachmentIcon(attachment.mimeType)} {attachment.fileName}
            </Text>
            <Text style={styles.meta}>
              {attachment.fileSizeBytes < 1024 * 1024
                ? `${Math.round(attachment.fileSizeBytes / 1024)} KB`
                : `${(attachment.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`}
            </Text>
            <Pressable onPress={() => removeAttachment(attachment.id)} disabled={disabled}>
              <Text style={styles.remove}>Entfernen</Text>
            </Pressable>
          </View>
          {isAudioMimeType(attachment.mimeType) ? (
            <VoicePendingPreview attachment={attachment} onDarkSurface={onDarkSurface} />
          ) : null}
        </View>
      ))}
      {compact ? (
        <View style={styles.pickerRow}>
          <Pressable
            style={styles.compactButton}
            onPress={() => void pickAttachment('camera')}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Kamera öffnen"
          >
            <Text style={styles.compactButtonText}>📷</Text>
          </Pressable>
          <Pressable
            style={styles.compactButton}
            onPress={() => void pickAttachment('library')}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Foto oder Video aus Galerie hinzufügen"
          >
            <Text style={styles.compactButtonText}>🖼️</Text>
          </Pressable>
          <Pressable
            style={styles.compactButton}
            onPress={() => void pickAttachment('document')}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Anhang hinzufügen"
          >
            <Text style={styles.compactButtonText}>📎</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.pickerRow}>
          <PremiumButton
            title="Kamera"
            size="sm"
            variant="secondary"
            onPress={() => void pickAttachment('camera')}
            disabled={disabled}
            onDarkSurface={onDarkSurface}
          />
          <PremiumButton
            title="Galerie"
            size="sm"
            variant="secondary"
            onPress={() => void pickAttachment('library')}
            disabled={disabled}
            onDarkSurface={onDarkSurface}
          />
          <PremiumButton
            title="Datei"
            size="sm"
            variant="secondary"
            onPress={() => void pickAttachment('document')}
            disabled={disabled}
            onDarkSurface={onDarkSurface}
          />
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
