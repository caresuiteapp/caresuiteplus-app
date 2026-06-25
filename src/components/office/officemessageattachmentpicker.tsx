import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { PremiumButton } from '@/components/ui';
import { auroraGlass, darkGlassSurfaceText, surfaceContrastText } from '@/design/tokens/auroraGlass';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';
import {
  isImageMimeType,
  isPdfMimeType,
  isAudioMimeType,
  validateMessageAttachment,
  type PendingMessageAttachment,
} from '@/lib/office/messageattachmentvalidation';
import { VoicePendingPreview } from '@/components/office/voicependingpreview';

type OfficeMessageAttachmentPickerProps = {
  attachments: PendingMessageAttachment[];
  onChange: (attachments: PendingMessageAttachment[]) => void;
  disabled?: boolean;
  error?: string | null;
  onError?: (message: string | null) => void;
  onDarkSurface?: boolean;
};

function createAttachmentId(): string {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `att-pending-${Date.now()}`;
}

async function readFileBytes(uri: string): Promise<Uint8Array> {
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

function attachmentIcon(mimeType: string): string {
  if (isImageMimeType(mimeType)) return '🖼️';
  if (isPdfMimeType(mimeType)) return '📄';
  if (isAudioMimeType(mimeType)) return '🎤';
  return '📎';
}

export function OfficeMessageAttachmentPicker({
  attachments,
  onChange,
  disabled,
  error,
  onError,
  onDarkSurface = false,
}: OfficeMessageAttachmentPickerProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const ink = onDarkSurface ? darkGlassSurfaceText : surfaceContrastText(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { gap: spacing.xs },
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

  const pickAttachment = async () => {
    onError?.(null);
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ],
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const fileName = asset.name ?? 'anhang';
    const mimeType = asset.mimeType ?? 'application/octet-stream';
    const fileSizeBytes = asset.size ?? 0;

    const validation = validateMessageAttachment({ fileName, mimeType, fileSizeBytes });
    if (!validation.ok) {
      onError?.(validation.error);
      return;
    }

    try {
      const fileData = await readFileBytes(asset.uri);
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
      <PremiumButton
        title="Anhang hinzufügen"
        size="sm"
        variant="secondary"
        onPress={() => void pickAttachment()}
        disabled={disabled}
        onDarkSurface={onDarkSurface}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
