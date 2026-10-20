import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import type { CommunicationAttachment } from '@/features/communication/communication.types';

type MessageAttachmentCardProps = { attachment: CommunicationAttachment };

export function MessageAttachmentCard({ attachment }: MessageAttachmentCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.filename}>📎 {attachment.filename}</Text>
      <Text style={styles.meta}>
        {(attachment.sizeBytes / 1024).toFixed(0)} KB · {attachment.scanStatus}
      </Text>
      <PremiumBadge label={attachment.attachmentType} variant="muted" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.bgPanel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  filename: { ...typography.bodyStrong, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textMuted },
});
