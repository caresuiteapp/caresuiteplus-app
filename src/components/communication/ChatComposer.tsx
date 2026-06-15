import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumInput } from '@/components/ui';
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
  quickEmojis?: readonly string[];
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
  quickEmojis = [],
}: ChatComposerProps) {
  return (
    <View style={styles.wrap}>
      {showInternalToggle ? (
        <Text style={styles.hint}>
          {isInternalNote ? COMMUNICATION_CONSENT_HINTS.internalNote : COMMUNICATION_CONSENT_HINTS.sensitive}
        </Text>
      ) : null}
      <View style={styles.emojiRow}>
        {quickEmojis.map((emoji) => (
          <PremiumButton
            key={emoji}
            title={emoji}
            size="sm"
            variant="ghost"
            onPress={() => onEmojiPress?.(emoji)}
          />
        ))}
      </View>
      <PremiumInput
        value={text}
        onChangeText={onChangeText}
        placeholder={isInternalNote ? 'Interne Notiz…' : 'Nachricht schreiben…'}
        multiline
        editable={!disabled}
      />
      <View style={styles.actions}>
        {showInternalToggle ? (
          <PremiumButton
            title={isInternalNote ? 'Notiz ✓' : 'Intern'}
            size="sm"
            variant={isInternalNote ? 'primary' : 'secondary'}
            onPress={onToggleInternalNote}
          />
        ) : null}
        <PremiumButton
          title={voicePreparedOnly ? '🎤 (vorbereitet)' : '🎤'}
          size="sm"
          variant="ghost"
          onPress={voicePreparedOnly ? undefined : onVoicePress}
          disabled={voicePreparedOnly || disabled}
        />
        <PremiumButton
          title="Senden"
          size="sm"
          onPress={onSend}
          loading={sending}
          disabled={disabled || !text.trim()}
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
  hint: { ...typography.caption, color: colors.cyan },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
});
