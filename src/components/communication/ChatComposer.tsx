import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumInput } from '@/components/ui';
import { auroraGlass, darkGlassSurfaceText, surfaceContrastText } from '@/design/tokens/auroraGlass';
import { colors, spacing, typography } from '@/theme';
import { COMMUNICATION_CONSENT_HINTS } from '@/features/communication/communication.constants';

type ChatComposerProps = {
  text: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  onToggleInternalNote?: () => void;
  isInternalNote?: boolean;
  showInternalToggle?: boolean;
  sending?: boolean;
  disabled?: boolean;
  onEmojiPress?: (emoji: string) => void;
  onVoicePress?: () => void;
  voicePreparedOnly?: boolean;
  voiceDisabled?: boolean;
  quickEmojis?: readonly string[];
  canSendWithAttachments?: boolean;
  attachmentPicker?: import('react').ReactNode;
  emojiPickerButton?: import('react').ReactNode;
  composerAccessory?: import('react').ReactNode;
  selection?: { start: number; end: number };
  onSelectionChange?: (selection: { start: number; end: number }) => void;
  /** Helle Schrift auf dunklem Chat-Eingabebereich. */
  onDarkSurface?: boolean;
};

export function ChatComposer({
  text,
  onChangeText,
  onSend,
  onToggleInternalNote,
  isInternalNote = false,
  showInternalToggle = false,
  sending = false,
  disabled = false,
  onEmojiPress,
  onVoicePress,
  voicePreparedOnly = false,
  voiceDisabled = false,
  quickEmojis = [],
  canSendWithAttachments = false,
  attachmentPicker,
  emojiPickerButton,
  composerAccessory,
  selection,
  onSelectionChange,
  onDarkSurface = false,
}: ChatComposerProps) {
  const canSend = Boolean(text.trim()) || canSendWithAttachments;
  const ink = onDarkSurface ? darkGlassSurfaceText : surfaceContrastText(false);

  return (
    <View style={[styles.wrap, onDarkSurface && styles.wrapDark]}>
      {showInternalToggle ? (
        <Text style={[styles.hint, onDarkSurface && { color: ink.secondary }]}>{isInternalNote ? COMMUNICATION_CONSENT_HINTS.internalNote : COMMUNICATION_CONSENT_HINTS.sensitive}</Text>
      ) : null}
      {composerAccessory}
      {attachmentPicker}
      <View style={styles.emojiRow}>
        {emojiPickerButton}
        {quickEmojis.map((emoji) => (
          <PremiumButton
            key={emoji}
            title={emoji}
            size="sm"
            variant="ghost"
            onPress={() => onEmojiPress?.(emoji)}
            onDarkSurface={onDarkSurface}
          />
        ))}
      </View>
      <PremiumInput
        value={text}
        onChangeText={onChangeText}
        placeholder={isInternalNote ? 'Interne Notiz…' : 'Nachricht schreiben…'}
        multiline
        editable={!disabled}
        onDarkSurface={onDarkSurface}
        selection={selection}
        onSelectionChange={(event) => onSelectionChange?.(event.nativeEvent.selection)}
      />
      <View style={styles.actions}>
        {showInternalToggle ? (
          <PremiumButton
            title={isInternalNote ? 'Notiz ✓' : 'Intern'}
            size="sm"
            variant={isInternalNote ? 'primary' : 'secondary'}
            onPress={onToggleInternalNote}
            onDarkSurface={onDarkSurface}
          />
        ) : null}
        <PremiumButton
          title={voicePreparedOnly ? '🎤 (vorbereitet)' : '🎤'}
          size="sm"
          variant="ghost"
          onPress={voicePreparedOnly ? undefined : onVoicePress}
          disabled={voicePreparedOnly || voiceDisabled || disabled || !onVoicePress}
          onDarkSurface={onDarkSurface}
        />
        <PremiumButton
          title="Senden"
          size="sm"
          onPress={onSend}
          loading={sending}
          disabled={disabled || !canSend}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.bgSurface,
  },
  wrapDark: {
    borderTopColor: auroraGlass.border,
    backgroundColor: auroraGlass.card,
  },
  hint: { ...typography.caption, color: colors.cyan },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
});
