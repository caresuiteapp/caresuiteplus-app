import { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { InfoBanner, PremiumButton } from '@/components/ui';
import { OfficeVoiceRecordingBar } from '@/components/office/officevoicerecordingbar';
import { useVoiceMessage } from '@/hooks/communication/useVoiceMessage';
import {
  getSpeechDictationUnsupportedMessage,
  isSpeechDictationSupported,
  runSpeechDictation,
} from '@/lib/platform/speechDictation';
import { uploadEmployeePortalVisitAttachment } from '@/lib/portal/employeePortalVisitAttachmentService';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { spacing, typography } from '@/theme';

type EmployeePortalVisitVoiceNoteModalProps = {
  visible: boolean;
  tenantId: string | null;
  visitId: string | null;
  onClose: () => void;
  onAppendText: (text: string) => void;
  onAudioUploaded?: (storagePath: string) => void;
};

export function EmployeePortalVisitVoiceNoteModal({
  visible,
  tenantId,
  visitId,
  onClose,
  onAppendText,
  onAudioUploaded,
}: EmployeePortalVisitVoiceNoteModalProps) {
  const text = useAuroraAdaptiveText();
  const deviceClass = useDeviceClass();
  const isMobile = !isDesktopClass(deviceClass);
  const voice = useVoiceMessage();
  const [dictating, setDictating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const dictationSupported = isSpeechDictationSupported();
  const isNative = Platform.OS !== 'web';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { gap: spacing.sm },
        hint: { ...typography.body, color: text.secondary },
        preview: {
          borderWidth: 1,
          borderColor: auroraGlass.innerBorder,
          borderRadius: 10,
          padding: spacing.sm,
          minHeight: 80,
        },
        previewText: { ...typography.body, color: text.primary },
        error: { ...typography.caption, color: '#EF4444' },
      }),
    [text],
  );

  const handleDictation = async () => {
    setLocalError(null);
    if (!isSpeechDictationSupported()) {
      setLocalError(getSpeechDictationUnsupportedMessage());
      return;
    }
    setDictating(true);
    const result = await runSpeechDictation();
    setDictating(false);
    if (!result.ok) {
      setLocalError(result.error);
      return;
    }
    onAppendText(result.transcript);
    onClose();
  };

  const handleStopRecording = async () => {
    setLocalError(null);
    const result = await voice.stop();
    if (!result.ok) return;

    const capture = result.data;
    const transcriptHint = `Sprachnotiz (${capture.durationSeconds}s)`;

    if (!tenantId || !visitId) {
      onAppendText(transcriptHint);
      onClose();
      return;
    }

    setUploading(true);
    const upload = await uploadEmployeePortalVisitAttachment({
      tenantId,
      visitId,
      fileName: capture.fileName,
      mimeType: capture.mimeType,
      bytes: capture.bytes,
    });
    setUploading(false);

    if (!upload.ok) {
      setLocalError(upload.error ?? 'Sprachnotiz konnte nicht gespeichert werden.');
      onAppendText(transcriptHint);
      onClose();
      return;
    }

    onAudioUploaded?.(upload.data.storagePath);
    onAppendText(`${transcriptHint} — Anhang gespeichert.`);
    onClose();
  };

  return (
    <PlatformModal
      visible={visible}
      title="Sprachnotiz"
      subtitle="Diktat oder Audio-Anhang"
      onClose={onClose}
      variant={isMobile ? 'bottomSheet' : 'center'}
      animationType={isMobile ? 'slide' : 'fade'}
      maxWidth={480}
    >
      <View style={styles.body}>
        {isNative ? (
          <InfoBanner
            variant="info"
            message="In der App wird Sprache als Audio-Anhang gespeichert. Live-Diktat steht im Browser zur Verfügung."
          />
        ) : (
          <Text style={styles.hint}>
            Nutzen Sie Diktat für Text in der Dokumentation oder nehmen Sie eine Sprachnotiz als Anhang auf.
          </Text>
        )}
        {dictationSupported ? (
          <PremiumButton
            title={dictating ? 'Sprache wird erkannt…' : 'Diktat starten'}
            loading={dictating}
            onPress={() => void handleDictation()}
          />
        ) : null}
        {voice.isSupported ? (
          <>
            {!voice.isRecording ? (
              <PremiumButton
                title="Sprachaufnahme starten"
                variant="secondary"
                onPress={() => void voice.start()}
              />
            ) : (
              <OfficeVoiceRecordingBar
                durationSeconds={voice.durationSeconds}
                onStop={() => void handleStopRecording()}
                onCancel={voice.cancel}
                stopping={uploading}
              />
            )}
          </>
        ) : (
          <Text style={styles.hint}>
            {isNative
              ? 'Audio-Aufnahme ist auf diesem Gerät nicht verfügbar.'
              : voice.unsupportedMessage}
          </Text>
        )}
        {localError ? <Text style={styles.error}>{localError}</Text> : null}
        {voice.error ? <Text style={styles.error}>{voice.error}</Text> : null}
      </View>
    </PlatformModal>
  );
}
