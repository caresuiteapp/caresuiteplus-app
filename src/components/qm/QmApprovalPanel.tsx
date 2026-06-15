import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumCard } from '@/components/ui';
import type { QmDocument } from '@/lib/qm';
import { colors, spacing, typography } from '@/theme';

type Props = {
  document: QmDocument;
  canApprove: boolean;
  onApprove?: () => void;
  loading?: boolean;
};

export function QmApprovalPanel({ document, canApprove, onApprove, loading }: Props) {
  const needsApproval = document.status === 'in_review' || document.status === 'draft';

  return (
    <PremiumCard accentColor={colors.orange}>
      <Text style={styles.title}>Freigabe</Text>
      <Text style={styles.body}>
        Status: {document.status}
        {needsApproval ? ' — Freigabe ausstehend' : ' — Keine Freigabe erforderlich'}
      </Text>
      {canApprove && needsApproval && onApprove && (
        <PremiumButton title="Freigeben" onPress={onApprove} loading={loading} fullWidth />
      )}
      {!canApprove && needsApproval && (
        <Text style={styles.hint}>Keine Berechtigung zur Freigabe.</Text>
      )}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.bodyStrong, marginBottom: spacing.xs },
  body: { ...typography.body, marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted },
});
