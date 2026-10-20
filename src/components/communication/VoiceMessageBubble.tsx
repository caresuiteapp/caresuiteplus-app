import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { COMMUNICATION_CONSENT_HINTS } from '@/features/communication/communication.constants';
import type { CommunicationAttachment } from '@/features/communication/communication.types';

type VoiceMessageBubbleProps = {
  attachment: CommunicationAttachment;
  isOwn?: boolean;
  onPlay?: () => void;
};

export function VoiceMessageBubble({ attachment, isOwn, onPlay }: VoiceMessageBubbleProps) {
  const duration = attachment.durationSeconds ?? 0;
  return (
    <View style={[styles.wrap, isOwn ? styles.own : styles.other]}>
      <PremiumButton title="▶" size="sm" variant="ghost" onPress={onPlay} />
      <View style={styles.wave}>
        {(attachment.waveformPreview ?? [0.3, 0.6, 0.4]).map((h, i) => (
          <View key={i} style={[styles.bar, { height: 8 + h * 16 }]} />
        ))}
      </View>
      <Text style={styles.duration}>{duration}s</Text>
      <Text style={styles.hint}>{COMMUNICATION_CONSENT_HINTS.voice}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.borderCyan,
  },
  own: { alignSelf: 'flex-end' },
  other: { alignSelf: 'flex-start' },
  wave: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 24 },
  bar: { width: 3, backgroundColor: colors.cyan, borderRadius: 2 },
  duration: { ...typography.caption, color: colors.textSecondary },
  hint: { ...typography.caption, color: colors.textMuted, width: '100%' },
});
