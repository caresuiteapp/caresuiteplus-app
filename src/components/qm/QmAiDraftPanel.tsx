import { StyleSheet, Text, View } from 'react-native';
import { PreparedModeBanner } from '@/components/modules/PreparedModeBanner';
import { PremiumButton, PremiumCard } from '@/components/ui';
import type { QmAiDraft } from '@/lib/qm';
import { colors, spacing, typography } from '@/theme';

type Props = {
  draft: QmAiDraft;
  onAccept?: () => void;
  onReject?: () => void;
  loading?: boolean;
};

export function QmAiDraftPanel({ draft, onAccept, onReject, loading }: Props) {
  return (
    <PremiumCard accentColor={colors.violet}>
      <PreparedModeBanner
        mode="prepared"
        hint="KI-generierte Inhalte sind Vorschläge und müssen durch QMB/PDL geprüft werden."
      />
      <Text style={styles.action}>{draft.action.replace(/_/g, ' ')}</Text>
      <Text style={styles.prompt}>{draft.promptSummary}</Text>
      <Text style={styles.content}>{draft.suggestedContent}</Text>
      {draft.status === 'pending' && (
        <View style={styles.actions}>
          <PremiumButton title="Übernehmen" onPress={onAccept} loading={loading} />
          <PremiumButton title="Verwerfen" variant="ghost" onPress={onReject} loading={loading} />
        </View>
      )}
      {draft.status !== 'pending' && (
        <Text style={styles.reviewed}>Status: {draft.status === 'accepted' ? 'Übernommen' : 'Verworfen'}</Text>
      )}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  action: { ...typography.caption, color: colors.textMuted, textTransform: 'capitalize', marginBottom: spacing.xs },
  prompt: { ...typography.bodyStrong, marginBottom: spacing.sm },
  content: { ...typography.body, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  reviewed: { ...typography.caption, color: colors.textMuted },
});
