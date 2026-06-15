import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { fetchActiveExecutions } from '@/lib/assist/executionService';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumButton, PremiumCard, PremiumInput, SuccessState } from '@/components/ui';
import { useActiveExecutions } from '@/hooks/useActiveExecutions';
import { usePermissions } from '@/hooks/usePermissions';
import type { ExecutionPhase } from '@/types/modules/assist';
import { colors, spacing, typography } from '@/theme';

const PHASE_LABELS: Record<ExecutionPhase, string> = {
  pending: 'Bereit',
  checked_in: 'Eingecheckt',
  in_progress: 'Läuft',
  completed: 'Abgeschlossen',
  cancelled: 'Abgebrochen',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function ActiveExecutionsScreen() {
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canView = can('assist.execution.view');
  const { items, loading, error, refreshing, showSuccess, refresh, isEmpty } = useActiveExecutions();

  if (!canView) {
    return (
      <ScreenShell title="Durchführung" subtitle="Kein Zugriff" showBack={false}>
        <LockedActionBanner
          message={check('assist.execution.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading && items.length === 0) {
    return (
      <ScreenShell title="Durchführung" subtitle="Wird geladen…" showBack={false}>
        <LoadingState message="Aktive Einsätze werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && items.length === 0) {
    return (
      <ScreenShell title="Durchführung" subtitle="Fehler" showBack={false}>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Durchführung" subtitle="Check-in & Zeiterfassung" showBack={false} scroll={false}>
      {showSuccess ? <SuccessState message="Liste aktualisiert." /> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.assignmentId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title="Keine aktiven Einsätze"
            message="Derzeit sind keine Einsätze für die Durchführung vorgesehen."
          />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <PremiumCard accentColor={colors.amber}>
            <View style={styles.cardHeader}>
              <Text style={styles.title}>{item.title}</Text>
              <PremiumBadge label={PHASE_LABELS[item.phase]} variant="orange" dot />
            </View>
            <Text style={styles.meta}>{item.clientName}</Text>
            <Text style={styles.meta}>{item.location}</Text>
            <Text style={styles.time}>
              {formatTime(item.scheduledStart)} – {formatTime(item.scheduledEnd)}
            </Text>
            <PremiumButton
              title={item.phase === 'pending' ? 'Einsatz durchführen' : 'Fortsetzen'}
              fullWidth
              onPress={() =>
                router.push(`/assist/assignments/${item.assignmentId}/execute` as never)
              }
              style={styles.btn}
            />
          </PremiumCard>
        )}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl, gap: spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, marginTop: 2 },
  time: { ...typography.caption, color: colors.cyan, marginTop: spacing.xs },
  btn: { marginTop: spacing.sm },
});
