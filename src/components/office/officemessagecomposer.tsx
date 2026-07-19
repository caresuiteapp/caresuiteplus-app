import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChatComposer } from '@/components/communication/ChatComposer';
import { CareEmojiPicker, CareEmojiPickerButton } from '@/components/office/careemojipicker';
import { OfficeMessageAttachmentPicker } from '@/components/office/officemessageattachmentpicker';
import { OfficeVoiceRecordingBar } from '@/components/office/officevoicerecordingbar';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useOfficeVoiceRecording } from '@/hooks/office/useofficevoicerecording';
import { insertTextAtSelection } from '@/lib/communication/composerutils';
import type { PendingMessageAttachment } from '@/lib/office/messageattachmentvalidation';
import { normalizeAttachmentMimeType } from '@/lib/office/messageattachmentvalidation';
import { spacing } from '@/theme';

type OfficeMessageComposerProps = {
  text: string;
  onChangeText: (value: string) => void;
  onSend: () => void | Promise<void>;
  sending?: boolean;
  disabled?: boolean;
  showInternalToggle?: boolean;
  isInternalNote?: boolean;
  onToggleInternalNote?: () => void;
  onDarkSurface?: boolean;
  pendingAttachments: PendingMessageAttachment[];
  onPendingAttachmentsChange: (attachments: PendingMessageAttachment[]) => void;
  attachmentError?: string | null;
  onAttachmentError?: (message: string | null) => void;
  showAttachmentPicker?: boolean;
};

export function OfficeMessageComposer({
  text,
  onChangeText,
  onSend,
  sending = false,
  disabled = false,
  showInternalToggle = false,
  isInternalNote = false,
  onToggleInternalNote,
  onDarkSurface = false,
  pendingAttachments,
  onPendingAttachmentsChange,
  attachmentError,
  onAttachmentError,
  showAttachmentPicker = true,
}: OfficeMessageComposerProps) {
  const { typography } = useLegacyTheme();
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [selection, setSelection] = useState({ start: text.length, end: text.length });
  const [stoppingVoice, setStoppingVoice] = useState(false);
  const voice = useOfficeVoiceRecording();

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      const result = insertTextAtSelection(text, emoji, selection);
      onChangeText(result.text);
      setSelection(result.selection);
    },
    [onChangeText, selection, text],
  );

  const handleVoicePress = useCallback(async () => {
    if (voice.isRecording) return;
    onAttachmentError?.(null);
    await voice.start();
  }, [onAttachmentError, voice]);

  const handleVoiceStop = useCallback(async () => {
    setStoppingVoice(true);
    const result = await voice.stop();
    setStoppingVoice(false);
    if (!result.ok) {
      onAttachmentError?.(result.error);
      return;
    }
    onPendingAttachmentsChange([
      ...pendingAttachments,
      {
        id: createAttachmentId(),
        fileName: result.data.fileName,
        mimeType: normalizeAttachmentMimeType(result.data.mimeType),
        fileSizeBytes: result.data.fileSizeBytes,
        fileData: result.data.fileData,
      },
    ]);
  }, [onAttachmentError, onPendingAttachmentsChange, pendingAttachments, voice]);

  const handleVoiceCancel = useCallback(() => {
    voice.cancel();
  }, [voice]);

  const composerAccessory = voice.isRecording ? (
    <OfficeVoiceRecordingBar
      durationSeconds={voice.durationSeconds}
      onStop={() => void handleVoiceStop()}
      onCancel={handleVoiceCancel}
      stopping={stoppingVoice}
      onDarkSurface={onDarkSurface}
    />
  ) : voice.error ? (
    <View style={styles.errorWrap}>
      <Text style={[typography.caption, { color: '#c0392b' }]}>{voice.error}</Text>
    </View>
  ) : null;

  return (
    <>
      <ChatComposer
        text={text}
        onChangeText={onChangeText}
        onSend={onSend}
        sending={sending}
        disabled={disabled || voice.isRecording}
        showInternalToggle={showInternalToggle}
        isInternalNote={isInternalNote}
        onToggleInternalNote={onToggleInternalNote}
        onDarkSurface={onDarkSurface}
        canSendWithAttachments={pendingAttachments.length > 0}
        selection={selection}
        onSelectionChange={setSelection}
        onVoicePress={() => void handleVoicePress()}
        voiceDisabled={!voice.isSupported || voice.isRecording}
        emojiPickerButton={
          <CareEmojiPickerButton
            onPress={() => setEmojiPickerVisible(true)}
            disabled={disabled || voice.isRecording}
            onDarkSurface={onDarkSurface}
          />
        }
        composerAccessory={composerAccessory}
        attachmentPicker={
          showAttachmentPicker ? (
            <OfficeMessageAttachmentPicker
              attachments={pendingAttachments}
              onChange={onPendingAttachmentsChange}
              disabled={sending || voice.isRecording}
              error={attachmentError}
              onError={onAttachmentError}
              onDarkSurface={onDarkSurface}
              compact
            />
          ) : null
        }
      />
      <CareEmojiPicker
        visible={emojiPickerVisible}
        onClose={() => setEmojiPickerVisible(false)}
        onSelect={handleEmojiSelect}
      />
    </>
  );
}

function createAttachmentId(): string {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `att-pending-${Date.now()}`;
}

const styles = StyleSheet.create({
  errorWrap: { paddingHorizontal: spacing.xs },
});
