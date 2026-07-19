import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { auroraGlass, darkGlassSurfaceText, surfaceContrastText } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';
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
  const [composerWidth, setComposerWidth] = useState(0);
  const isCompact = composerWidth > 0 && composerWidth < 620;
  const isWide = composerWidth >= 680;
  const canSend = Boolean(text.trim()) || canSendWithAttachments;
  const ink = onDarkSurface ? darkGlassSurfaceText : surfaceContrastText(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          gap: 6,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: spacing.md,
          borderTopWidth: 1,
          borderTopColor: onDarkSurface ? auroraGlass.border : c.border,
          backgroundColor: onDarkSurface ? auroraGlass.card : c.surfaceAlt,
          flexShrink: 0,
        },
        hint: { ...typography.caption, color: onDarkSurface ? ink.secondary : c.muted, flexShrink: 1 },
        toolbar: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          flexWrap: isCompact ? 'nowrap' : 'wrap',
        },
        toolButton: {
          minHeight: 36,
          width: isCompact ? 36 : undefined,
          paddingHorizontal: isCompact ? 0 : spacing.sm,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: onDarkSurface ? auroraGlass.chip : c.surface,
          borderWidth: 1,
          borderColor: onDarkSurface ? auroraGlass.border : c.border,
        },
        toolButtonActive: { backgroundColor: `${c.violet}16`, borderColor: c.violet },
        toolText: { ...typography.caption, color: onDarkSurface ? ink.primary : c.text, fontWeight: '700' },
        inputShell: {
          minHeight: isWide ? 58 : 64,
          maxHeight: 144,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.sm,
          paddingLeft: spacing.md,
          paddingRight: 6,
          paddingVertical: 6,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: isInternalNote ? c.warning : c.border,
          backgroundColor: onDarkSurface ? auroraGlass.input : c.surface,
          shadowColor: c.shadow,
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
        },
        input: {
          flex: 1,
          minHeight: 44,
          maxHeight: 126,
          paddingVertical: 10,
          color: onDarkSurface ? ink.primary : c.text,
          fontSize: 16,
          lineHeight: 22,
        },
        sendButton: {
          minWidth: isWide ? 112 : 54,
          height: 46,
          paddingHorizontal: isWide ? spacing.md : spacing.sm,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.violet,
        },
        sendButtonDisabled: { opacity: 0.4 },
        sendText: { ...typography.body, color: '#FFFFFF', fontWeight: '800' },
      }),
    [c, ink, isCompact, isInternalNote, isWide, onDarkSurface],
  );

  return (
    <View
      style={styles.wrap}
      testID="messaging-composer"
      onLayout={(event) => setComposerWidth(Math.round(event.nativeEvent.layout.width))}
    >
      {composerAccessory}
      <View style={styles.toolbar}>
        {attachmentPicker}
        {emojiPickerButton}
        {quickEmojis.map((emoji) => (
          <Pressable key={emoji} style={styles.toolButton} onPress={() => onEmojiPress?.(emoji)}>
            <Text style={styles.toolText}>{emoji}</Text>
          </Pressable>
        ))}
        <Pressable
          style={styles.toolButton}
          onPress={voicePreparedOnly ? undefined : onVoicePress}
          disabled={voicePreparedOnly || voiceDisabled || disabled || !onVoicePress}
          accessibilityRole="button"
          accessibilityLabel="Sprachnachricht aufnehmen"
        >
          <Text style={styles.toolText}>
            {isCompact ? '🎤' : voicePreparedOnly ? '🎤 Vorbereitet' : '🎤 Sprache'}
          </Text>
        </Pressable>
        {showInternalToggle ? (
          <Pressable
            style={[styles.toolButton, isInternalNote && styles.toolButtonActive]}
            onPress={onToggleInternalNote}
            accessibilityRole="button"
            accessibilityLabel="Interne Notiz umschalten"
          >
            <Text style={styles.toolText}>
              {isCompact ? '🔒' : isInternalNote ? '🔒 Interne Notiz aktiv' : '🔒 Interne Notiz'}
            </Text>
          </Pressable>
        ) : null}
        {!isCompact ? (
          <Text style={styles.hint} numberOfLines={1}>
            {isInternalNote ? COMMUNICATION_CONSENT_HINTS.internalNote : COMMUNICATION_CONSENT_HINTS.sensitive}
          </Text>
        ) : null}
      </View>
      <View style={styles.inputShell}>
        <TextInput
          testID="chat-composer-input"
          value={text}
          onChangeText={onChangeText}
          placeholder={isInternalNote ? 'Interne Notiz schreiben…' : 'Nachricht schreiben…'}
          placeholderTextColor={onDarkSurface ? ink.muted : c.muted}
          multiline
          editable={!disabled}
          selection={selection}
          onSelectionChange={(event) => onSelectionChange?.(event.nativeEvent.selection)}
          style={styles.input}
        />
        <Pressable
          testID="chat-composer-send"
          style={[styles.sendButton, (disabled || !canSend || sending) && styles.sendButtonDisabled]}
          onPress={onSend}
          disabled={disabled || !canSend || sending}
          accessibilityRole="button"
          accessibilityLabel="Nachricht senden"
        >
          {sending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.sendText}>{isWide ? 'Senden  ↑' : '↑'}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
