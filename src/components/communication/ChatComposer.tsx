import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type LayoutChangeEvent, type TextStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { auroraGlass, darkGlassSurfaceText, surfaceContrastText } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';
import { COMMUNICATION_CONSENT_HINTS } from '@/features/communication/communication.constants';
import { employeePortalDesign as employeeInk } from '@/components/portal/employee/employeePortalDesign';
import { agendaFocusRing } from '@/components/portal/employee/EmployeePortalAgendaAction';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';

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
  appearance?: 'employee';
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
  appearance,
}: ChatComposerProps) {
  const { c } = useCareLightPalette();
  const { height } = useWindowDimensions();
  const [composerWidth, setComposerWidth] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const isCompact = composerWidth > 0 && composerWidth < 620;
  const isWide = composerWidth >= 680;
  const canSend = Boolean(text.trim()) || canSendWithAttachments;
  const sendDisabled = disabled || !canSend || sending;
  const employee = appearance === 'employee';
  const shortViewport = employee && height <= 500;
  const inlinePrivacy = shortViewport && composerWidth >= 540;
  const showSendLabel = composerWidth >= 400;
  const employeeSendInk = sendDisabled && !sending ? employeeInk.muted : employeeInk.canvas;
  const ink = onDarkSurface ? darkGlassSurfaceText : surfaceContrastText(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          gap: 4,
          paddingHorizontal: 8,
          paddingTop: 5,
          paddingBottom: 7,
          borderTopWidth: 1,
          borderTopColor: onDarkSurface ? auroraGlass.border : c.border,
          backgroundColor: onDarkSurface ? auroraGlass.card : c.surfaceAlt,
          flexShrink: 0,
        },
        hint: { ...typography.caption, color: onDarkSurface ? ink.secondary : c.muted, flexShrink: 1 },
        toolbar: {
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 44,
          gap: 5,
          flexWrap: 'nowrap',
          overflow: 'hidden',
        },
        toolButton: {
          minHeight: 44,
          width: isCompact ? 44 : undefined,
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
          minHeight: isCompact ? 62 : 82,
          maxHeight: 132,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.sm,
          paddingLeft: spacing.md,
          paddingRight: 6,
          paddingVertical: 6,
          borderRadius: 18,
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
          minWidth: 0,
          minHeight: isCompact ? 46 : 66,
          maxHeight: 116,
          paddingTop: 8,
          paddingBottom: 6,
          color: onDarkSurface ? ink.primary : c.text,
          fontSize: 16,
          lineHeight: 22,
          textAlignVertical: 'top',
          overflow: 'scroll',
        },
        sendButton: {
          minWidth: isWide ? 112 : 54,
          minHeight: 44,
          paddingVertical: spacing.xs,
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

  const measureComposer = (event: LayoutChangeEvent) => setComposerWidth(Math.round(event.nativeEvent.layout.width));
  const editor = (
    <View style={[
      styles.inputShell, employee && employeeStyles.inputShell, employee && inputFocused && employeeStyles.inputFocused,
      inlinePrivacy && employeeStyles.editorColumn,
    ]}>
      <TextInput
        testID="chat-composer-input"
        accessibilityLabel={isInternalNote ? 'Interne Notiz schreiben' : 'Nachricht schreiben'}
        value={text}
        onChangeText={onChangeText}
        placeholder={isInternalNote ? 'Interne Notiz schreiben…' : 'Nachricht schreiben…'}
        placeholderTextColor={employee ? employeeInk.muted : onDarkSurface ? ink.muted : c.muted}
        multiline
        numberOfLines={shortViewport ? 1 : undefined}
        editable={!disabled}
        selection={selection}
        onSelectionChange={(event) => onSelectionChange?.(event.nativeEvent.selection)}
        onFocus={employee ? () => setInputFocused(true) : undefined}
        onBlur={employee ? () => setInputFocused(false) : undefined}
        style={[styles.input, employee && employeeStyles.input, shortViewport && employeeStyles.shortInput]}
      />
      <Pressable
        testID="chat-composer-send"
        style={({ focused, pressed }: { focused?: boolean; pressed: boolean }) => [
          styles.sendButton,
          employee ? [
            employeeStyles.send, showSendLabel && employeeStyles.sendWithLabel,
            sendDisabled && !sending && employeeStyles.sendDisabled,
            focused && agendaFocusRing, pressed && employeeStyles.sendPressed,
          ] : sendDisabled && styles.sendButtonDisabled,
        ]}
        onPress={onSend}
        disabled={sendDisabled}
        accessibilityRole="button"
        accessibilityLabel="Nachricht senden"
        accessibilityState={{ disabled: sendDisabled, busy: sending }}
      >
        {sending ? (
          <ActivityIndicator color={employee ? employeeSendInk : '#FFFFFF'} />
        ) : employee ? (
          <>
            <Ionicons name="send-outline" size={19} color={employeeSendInk} accessible={false} />
            {showSendLabel ? <Text style={[employeeStyles.sendLabel, { color: employeeSendInk }]}>Senden</Text> : null}
          </>
        ) : (
          <Text style={styles.sendText}>{isWide ? 'Senden  ↑' : '↑'}</Text>
        )}
      </Pressable>
    </View>
  );

  if (employee) {
    const privacy = (
      <View style={[employeeStyles.privacy, inlinePrivacy && employeeStyles.inlinePrivacy]}>
        <Ionicons name="shield-checkmark-outline" color={employeeInk.accent} size={16} accessible={false} />
        <Text style={employeeStyles.hint}>Sensible Angaben nur bei Bedarf teilen.</Text>
      </View>
    );
    return (
      <View style={employeeStyles.dock} testID="messaging-composer">
        <View style={[employeeStyles.inner, shortViewport && employeeStyles.shortInner]} onLayout={measureComposer}>
          {composerAccessory}
          {attachmentPicker}
          <View style={inlinePrivacy ? employeeStyles.editorRow : employeeStyles.editorStack}>
            {editor}
            {privacy}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={styles.wrap}
      testID="messaging-composer"
      onLayout={measureComposer}
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
      {editor}
    </View>
  );
}

const employeeStyles = StyleSheet.create(withCareSuiteTypography({
  dock: { flexShrink: 0, backgroundColor: employeeInk.canvas, borderTopWidth: 1, borderTopColor: employeeInk.line },
  inner: { alignSelf: 'center', width: '100%', maxWidth: 880, minWidth: 0, gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
  shortInner: { gap: 6, paddingVertical: 6 },
  editorStack: { gap: 6 },
  editorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editorColumn: { flex: 1, minWidth: 0 },
  inputShell: {
    minHeight: 60, borderRadius: 14, borderColor: employeeInk.line,
    backgroundColor: employeeInk.control, shadowOpacity: 0,
  },
  inputFocused: { borderColor: employeeInk.accent },
  input: {
    minHeight: 46, color: employeeInk.text, fontSize: font(16), lineHeight: font(24),
    ...(Platform.OS === 'web' ? ({
      overflow: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(188,238,255,0.48) transparent',
    } as unknown as TextStyle) : null),
  },
  shortInput: { minHeight: 44, paddingVertical: 4 },
  send: {
    minWidth: 44, minHeight: 44, flexDirection: 'row', gap: 7,
    borderWidth: 1, borderColor: employeeInk.accent, borderRadius: 10, backgroundColor: employeeInk.accent,
  },
  sendWithLabel: { paddingHorizontal: 12 },
  sendDisabled: { borderColor: employeeInk.line, backgroundColor: employeeInk.raised },
  sendPressed: { opacity: 0.82 },
  sendLabel: { fontSize: font(14), lineHeight: font(20), fontWeight: '700' },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  inlinePrivacy: { flexShrink: 1, maxWidth: '36%' },
  hint: { flexShrink: 1, color: employeeInk.muted, fontSize: font(13), lineHeight: font(19) },
}));
