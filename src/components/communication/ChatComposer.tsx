import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumInput } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
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
  const { c } = useCareLightPalette();
  const canSend = Boolean(text.trim()) || canSendWithAttachments;
  const ink = onDarkSurface ? darkGlassSurfaceText : surfaceContrastText(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          gap: spacing.sm,
          padding: spacing.md,
          borderTopWidth: 1,
          borderTopColor: onDarkSurface ? auroraGlass.border : c.border,
          backgroundColor: onDarkSurface ? auroraGlass.card : c.surface,
          flexShrink: 0,
        },
        hint: { ...typography.caption, color: onDarkSurface ? ink.secondary : colors.cyan },
        emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
        actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
      }),
    [c.border, c.surface, ink.secondary, onDarkSurface],
  );

  return (
    <View style={styles.wrap} testID="messaging-composer">
      {showInternalToggle ? (
        <Text style={[styles.hint]}>{isInternalNote ? COMMUNICATION_CONSENT_HINTS.internalNote : COMMUNICATION_CONSENT_HINTS.sensitive}</Text>
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
        testID="chat-composer-input"
        value={text}
        onChangeText={onChangeText}
        placeholder={isInternalNote ? 'Interne Notiz…' : 'Nachricht schreiben…'}
        multiline
        editable={!disabled}
        onDarkSurface={onDarkSurface}
        viewContext={onDarkSurface ? undefined : 'form'}
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
          testID="chat-composer-send"
          onPress={onSend}
          loading={sending}
          disabled={disabled || !canSend}
        />
      </View>
    </View>
  );
}

