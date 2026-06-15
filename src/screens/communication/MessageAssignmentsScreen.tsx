import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MessageAssignmentPanel } from '@/components/communication';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { LoadingState, PremiumBadge } from '@/components/ui';
import { useMessageAssignments, useCommunicationPermissions } from '@/hooks/communication';
import { colors, spacing, typography } from '@/theme';

export function MessageAssignmentsScreen() {
  const perms = useCommunicationPermissions();
  const { openAssignments, loading, refresh } = useMessageAssignments();

  if (!perms.canAssign) {
    return (
      <ScreenShell title="Zuordnungen">
        <LockedActionBanner message="Keine Berechtigung für Nachrichtenzuordnung." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Zuordnungen" subtitle="Offene Nachrichtenzuordnungen">
      {loading ? <LoadingState message="Zuordnungen werden geladen…" /> : null}
      <ScrollView contentContainerStyle={styles.scroll}>
        {openAssignments.map((a) => (
          <View key={a.id} style={styles.card}>
            <Text style={styles.title}>Thread {a.threadId}</Text>
            <PremiumBadge label={a.status} variant="cyan" />
            <Text style={styles.meta}>
              {a.targetType} → {a.targetId ?? '—'}
            </Text>
          </View>
        ))}
        <MessageAssignmentPanel suggestions={[]} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.bgPanel,
    borderRadius: 12,
  },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textMuted },
});
