import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { colors, radius, spacing, typography } from '@/theme';
import type { CommunicationMessage } from '@/features/communication/communication.types';
import { MessageStatusTicks } from './MessageStatusTicks';
import { employeePortalDesign } from '@/components/portal/employee/employeePortalDesign';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';

type ChatBubbleProps = {
  message: CommunicationMessage;
  isOwn: boolean;
  showStatus?: boolean;
  appearance?: 'employee';
};

export function ChatBubble({ message, isOwn, showStatus = true, appearance }: ChatBubbleProps) {
  const { c } = useCareLightPalette();
  const { typography: adaptiveTypography } = useLegacyTheme();
  const [copied, setCopied] = useState(false);
  const employee = appearance === 'employee';
  const isSystem = message.contentType === 'system';
  const isDeleted = message.status === 'deleted' || !!message.deletedAt;
  const body = isDeleted
    ? 'Nachricht gelöscht'
    : message.bodyText ?? (message.hasVoice ? '🎤 Sprachnachricht' : '');

  const adaptiveStyles = useMemo(
    () =>
      StyleSheet.create({
        bubbleOwn: {
          backgroundColor: c.violet,
          borderColor: c.violet,
        },
        bubbleOther: {
          backgroundColor: c.surface,
          borderColor: c.border,
        },
        sender: { ...adaptiveTypography.caption, color: isOwn ? 'rgba(255,255,255,0.82)' : c.violet, fontWeight: '800' },
        body: { ...adaptiveTypography.body, color: isOwn ? '#FFFFFF' : c.text, fontSize: 16, lineHeight: 24 },
        muted: { ...adaptiveTypography.caption, color: isOwn ? 'rgba(255,255,255,0.72)' : c.muted },
        copyText: {
          ...adaptiveTypography.caption,
          color: copied ? colors.success : isOwn ? '#FFFFFF' : c.violet,
          fontWeight: '700',
        },
      }),
    [adaptiveTypography, c, copied, isOwn],
  );

  const copyMessage = async () => {
    if (!body || isDeleted) return;
    await Clipboard.setStringAsync(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (isSystem) {
    return (
      <View style={styles.systemWrap}>
        <Text selectable style={styles.systemText}>{body}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <View
        testID={`message-bubble-${message.id}`}
        style={[
          styles.bubble,
          isOwn ? adaptiveStyles.bubbleOwn : adaptiveStyles.bubbleOther,
          message.isInternalNote && styles.bubbleInternal,
          employee && employeeStyles.bubble,
          employee && (isOwn ? employeeStyles.own : employeeStyles.other),
        ]}
      >
        <Text style={[adaptiveStyles.sender, employee && employeeStyles.sender]}>{isOwn ? 'Sie' : message.senderDisplayName}</Text>
        <Text selectable style={[adaptiveStyles.body, employee && employeeStyles.body]} testID={`message-body-${message.id}`}>
          {body}
        </Text>
        <View style={styles.meta} testID={`message-meta-${message.id}`}>
          <Text style={[adaptiveStyles.muted, employee && employeeStyles.muted]}>
            {new Date(message.sentAt ?? message.createdAt).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {message.editedAt ? <Text style={[adaptiveStyles.muted, employee && employeeStyles.muted, styles.edited]}>bearbeitet</Text> : null}
          {showStatus && isOwn ? <MessageStatusTicks status={message.status} /> : null}
          {!isDeleted && body ? (
            <Pressable
              onPress={() => void copyMessage()}
              hitSlop={8}
              style={styles.copyButton}
              accessibilityRole="button"
              accessibilityLabel="Nachricht kopieren"
              testID={`copy-message-${message.id}`}
            >
              <Text style={[adaptiveStyles.copyText, employee && employeeStyles.sender]}>{copied ? '✓ Kopiert' : 'Kopieren'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: 6, paddingHorizontal: spacing.lg },
  rowOwn: { alignItems: 'flex-end' },
  rowOther: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '72%',
    minWidth: 200,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
  },
  bubbleOwn: {
    borderBottomRightRadius: radius.sm,
  },
  bubbleOther: {
    borderBottomLeftRadius: radius.sm,
  },
  bubbleInternal: {
    backgroundColor: colors.bgPanel,
    borderColor: colors.warning,
    borderStyle: 'dashed',
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  copyButton: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.capsule },
  edited: { fontStyle: 'italic' },
  systemWrap: { alignItems: 'center', marginVertical: spacing.sm },
  systemText: {
    ...typography.caption,
    color: colors.textSecondary,
    backgroundColor: colors.bgPanel,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.capsule,
  },
});

const textWrap = Platform.OS === 'web' ? { overflowWrap: 'anywhere' } as TextStyle : undefined;
const employeeStyles = StyleSheet.create({
  bubble: { minWidth: 0, maxWidth: '88%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, shadowOpacity: 0 },
  own: { backgroundColor: employeePortalDesign.messageOwn, borderColor: '#497785', borderBottomRightRadius: 5 },
  other: { backgroundColor: employeePortalDesign.messageOther, borderColor: employeePortalDesign.line, borderBottomLeftRadius: 5 },
  sender: { color: employeePortalDesign.accent, fontSize: font(11), lineHeight: font(17), ...textWrap },
  body: { color: employeePortalDesign.text, fontSize: font(14), lineHeight: font(21), ...textWrap },
  muted: { color: employeePortalDesign.muted, fontSize: font(11), lineHeight: font(17) },
});
