import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PremiumButton } from '@/components/ui';
import { auroraGlass, darkGlassSurfaceText, surfaceContrastText } from '@/design/tokens/auroraGlass';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { EmployeePortalAgendaAction } from '@/components/portal/employee/EmployeePortalAgendaAction';
import { employeePortalDesign as employeeInk } from '@/components/portal/employee/employeePortalDesign';
import { employeeMessageAttachmentIcon } from './employeeMessageAttachmentIcon';
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
  releaseEmployeePortalMediaUri,
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
  appearance?: 'employee';
  trailingActions?: ReactNode;
};

const employeePickActions = [
  { source: 'camera', icon: 'camera-outline', label: 'Kamera öffnen' },
  { source: 'library', icon: 'images-outline', label: 'Foto oder Video aus Galerie hinzufügen' },
  { source: 'document', icon: 'attach-outline', label: 'Anhang hinzufügen' },
] as const;

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
  appearance,
  trailingActions,
}: OfficeMessageAttachmentPickerProps) {
  const { c } = useCareLightPalette();
  const { height } = useWindowDimensions();
  const { typography } = useLegacyTheme();
  const ink = onDarkSurface ? darkGlassSurfaceText : surfaceContrastText(false);
  const [picking, setPicking] = useState(false);
  const pickingRef = useRef(false);
  const mounted = useRef(true);
  const pendingScroll = useRef<ScrollView>(null);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const pickerDisabled = disabled || picking;
  const employee = appearance === 'employee';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { gap: spacing.xs, alignSelf: 'flex-start', maxWidth: '100%' },
        pickerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
        compactButton: {
          minHeight: 44,
          width: 44,
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
        releaseEmployeePortalMediaUri(media.uri);
        return;
      }
    }

    try {
      const fileData = await readEmployeePortalMediaBytes(media.uri);
      const validated = validateMessageAttachment({
        fileName,
        mimeType,
        fileSizeBytes: fileData.length,
      });
      if (!validated.ok) {
        if (mounted.current) onError?.(validated.error);
        return;
      }

      if (!mounted.current) return;
      onChange([
        ...attachmentsRef.current,
        {
          id: createAttachmentId(),
          fileName,
          mimeType,
          fileSizeBytes: fileData.length,
          fileData,
        },
      ]);
    } catch {
      if (mounted.current) onError?.('Datei konnte nicht gelesen werden.');
    } finally {
      // The composer owns copied bytes, so a browser camera/library blob is
      // no longer needed for retries once this selection has been read.
      releaseEmployeePortalMediaUri(media.uri);
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
    if (disabled || pickingRef.current) return;
    pickingRef.current = true;
    setPicking(true);
    onError?.(null);
    try {
      const result =
        source === 'camera'
          ? await openEmployeePortalCamera()
          : source === 'library'
            ? await openEmployeePortalMediaLibrary()
            : await openEmployeePortalDocumentPicker({ includeMediaFallback: true });
      if (!mounted.current) {
        if (result.ok && result.media) releaseEmployeePortalMediaUri(result.media.uri);
        return;
      }
      await handlePickerResult(result);
    } catch {
      if (mounted.current) onError?.('Die Dateiauswahl konnte nicht geöffnet werden. Bitte versuchen Sie es erneut.');
    } finally {
      pickingRef.current = false;
      if (mounted.current) setPicking(false);
    }
  };

  const removeAttachment = (id: string) => {
    onChange(attachments.filter((item) => item.id !== id));
  };

  const pendingFiles = attachments.map((attachment) => (
    <View key={attachment.id} style={[styles.attachmentBlock, employee && employeeStyles.file]}>
      <View style={styles.row}>
        {employee && Platform.OS === 'web' && isAudioMimeType(attachment.mimeType) ? (
          <VoicePendingPreview attachment={attachment} appearance={appearance} />
        ) : employee ? (
          <Ionicons name={employeeMessageAttachmentIcon(attachment.mimeType)} color={employeeInk.accent} size={20} accessible={false} />
        ) : null}
        <Text style={[styles.name, employee && employeeStyles.fileName]} numberOfLines={employee ? 2 : undefined}>
          {employee ? attachment.fileName : `${attachmentIcon(attachment.mimeType)} ${attachment.fileName}`}
        </Text>
        <Text style={[styles.meta, employee && employeeStyles.fileSize]}>
          {attachment.fileSizeBytes < 1024 * 1024
            ? `${Math.round(attachment.fileSizeBytes / 1024)} KB`
            : `${(attachment.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`}
        </Text>
        {employee ? (
          <EmployeePortalAgendaAction iconOnly icon="close-outline" label={`${attachment.fileName} entfernen`}
            onPress={() => removeAttachment(attachment.id)} disabled={disabled} />
        ) : (
          <Pressable onPress={() => removeAttachment(attachment.id)} disabled={disabled}>
            <Text style={styles.remove}>Entfernen</Text>
          </Pressable>
        )}
      </View>
      {!employee && isAudioMimeType(attachment.mimeType) ? (
        <VoicePendingPreview attachment={attachment} onDarkSurface={onDarkSurface} />
      ) : null}
    </View>
  ));

  if (employee) {
    const shortViewport = height <= 500;
    return (
      <View style={employeeStyles.root}>
        <View style={shortViewport ? employeeStyles.inlineTools : employeeStyles.root}>
          <View style={employeeChatToolbarStyle}>
            {employeePickActions.map(({ source, icon, label }) => (
              <EmployeePortalAgendaAction key={source} iconOnly icon={icon} label={label}
                onPress={() => void pickAttachment(source)} disabled={pickerDisabled} />
            ))}
            {trailingActions}
            {pendingFiles.length > 0 ? (
              <Text style={employeeStyles.fileSize}>{pendingFiles.length} {pendingFiles.length === 1 ? 'Anhang' : 'Anhänge'}</Text>
            ) : null}
          </View>
          {pendingFiles.length > 0 ? (
            <ScrollView ref={pendingScroll} horizontal
              style={[employeeStyles.pending, shortViewport && employeeStyles.inlinePending]}
              contentContainerStyle={employeeStyles.pendingContent} keyboardShouldPersistTaps="handled"
              accessibilityLabel="Anhänge zum Senden"
              onContentSizeChange={() => pendingScroll.current?.scrollToEnd({ animated: false })}>
              {pendingFiles}
            </ScrollView>
          ) : null}
        </View>
        {error ? <Text accessibilityRole="alert" style={employeeStyles.error}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {pendingFiles}
      {compact ? (
        <View style={styles.pickerRow}>
          <Pressable
            style={styles.compactButton}
            onPress={() => void pickAttachment('camera')}
            disabled={pickerDisabled}
            accessibilityRole="button"
            accessibilityLabel="Kamera öffnen"
          >
            <Text style={styles.compactButtonText}>📷</Text>
          </Pressable>
          <Pressable
            style={styles.compactButton}
            onPress={() => void pickAttachment('library')}
            disabled={pickerDisabled}
            accessibilityRole="button"
            accessibilityLabel="Foto oder Video aus Galerie hinzufügen"
          >
            <Text style={styles.compactButtonText}>🖼️</Text>
          </Pressable>
          <Pressable
            style={styles.compactButton}
            onPress={() => void pickAttachment('document')}
            disabled={pickerDisabled}
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
            disabled={pickerDisabled}
            onDarkSurface={onDarkSurface}
          />
          <PremiumButton
            title="Galerie"
            size="sm"
            variant="secondary"
            onPress={() => void pickAttachment('library')}
            disabled={pickerDisabled}
            onDarkSurface={onDarkSurface}
          />
          <PremiumButton
            title="Datei"
            size="sm"
            variant="secondary"
            onPress={() => void pickAttachment('document')}
            disabled={pickerDisabled}
            onDarkSurface={onDarkSurface}
          />
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export const employeeChatToolbarStyle = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', maxWidth: '100%', gap: 7 },
}).row;

const employeeStyles = StyleSheet.create(withCareSuiteTypography({
  root: { gap: 8, minWidth: 0 },
  inlineTools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  pending: {
    flexGrow: 0,
    ...(Platform.OS === 'web' ? ({
      scrollbarWidth: 'thin', scrollbarColor: 'rgba(188,238,255,0.48) transparent',
    } as ViewStyle) : null),
  },
  inlinePending: { flexGrow: 1, flexBasis: 246, maxWidth: '100%' },
  pendingContent: { gap: 7, alignItems: 'flex-start', paddingBottom: 3 },
  file: { width: 246, paddingHorizontal: 8, paddingVertical: 4, borderColor: employeeInk.line, backgroundColor: employeeInk.control },
  fileName: { minWidth: 0, color: employeeInk.text, fontSize: font(14), lineHeight: font(20) },
  fileSize: { color: employeeInk.muted, fontSize: font(12), lineHeight: font(18) },
  error: { color: employeeInk.danger, fontSize: font(13), lineHeight: font(19) },
}));
