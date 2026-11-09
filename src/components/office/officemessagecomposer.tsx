import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChatComposer } from '@/components/communication/ChatComposer';
import { CareEmojiPicker, CareEmojiPickerButton } from '@/components/office/careemojipicker';
import { OfficeMessageAttachmentPicker, employeeChatToolbarStyle } from '@/components/office/officemessageattachmentpicker';
import { OfficeVoiceRecordingBar } from '@/components/office/officevoicerecordingbar';
import { EmployeePortalAgendaAction } from '@/components/portal/employee/EmployeePortalAgendaAction';
import { employeePortalDesign as employeeInk } from '@/components/portal/employee/employeePortalDesign';
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
  appearance?: 'employee';
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
  appearance,
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
  const employee = appearance === 'employee';
  const toolsDisabled = disabled || voice.isRecording || stoppingVoice || sending;

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
      appearance={appearance}
    />
  ) : voice.error ? (
    <View style={styles.errorWrap}>
      <Text accessibilityRole="alert" style={[typography.caption, { color: employee ? employeeInk.danger : '#c0392b' }]}>{voice.error}</Text>
    </View>
  ) : null;
  const employeeTools = employee ? (
    <>
      <EmployeePortalAgendaAction iconOnly icon="happy-outline" label="Emoji-Auswahl öffnen"
        onPress={() => setEmojiPickerVisible(true)} disabled={toolsDisabled} />
      <EmployeePortalAgendaAction iconOnly icon="mic-outline" label="Sprachnachricht aufnehmen"
        onPress={() => void handleVoicePress()} disabled={toolsDisabled || !voice.isSupported} />
    </>
  ) : null;

  return (
    <>
      <ChatComposer
        text={text}
        onChangeText={onChangeText}
        onSend={onSend}
        sending={sending}
        disabled={disabled || voice.isRecording || (employee && stoppingVoice)}
        showInternalToggle={showInternalToggle}
        isInternalNote={isInternalNote}
        onToggleInternalNote={onToggleInternalNote}
        onDarkSurface={onDarkSurface}
        appearance={appearance}
        canSendWithAttachments={pendingAttachments.length > 0}
        selection={selection}
        onSelectionChange={setSelection}
        onVoicePress={() => void handleVoicePress()}
        voiceDisabled={!voice.isSupported || voice.isRecording}
        emojiPickerButton={employee ? null : (
          <CareEmojiPickerButton
            onPress={() => setEmojiPickerVisible(true)}
            disabled={disabled || voice.isRecording}
            onDarkSurface={onDarkSurface}
          />
        )}
        composerAccessory={composerAccessory}
        attachmentPicker={
          showAttachmentPicker ? (
            <View style={employee && voice.isRecording ? styles.hiddenTools : undefined}>
              <OfficeMessageAttachmentPicker
                attachments={pendingAttachments}
                onChange={onPendingAttachmentsChange}
                disabled={employee ? toolsDisabled : sending || voice.isRecording}
                error={attachmentError}
                onError={onAttachmentError}
                onDarkSurface={onDarkSurface}
                appearance={appearance}
                trailingActions={employeeTools}
                compact
              />
            </View>
          ) : employee && !voice.isRecording ? <View style={employeeChatToolbarStyle}>{employeeTools}</View> : null
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
  hiddenTools: { display: 'none' },
});
