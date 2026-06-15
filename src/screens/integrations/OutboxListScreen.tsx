import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OutboxListHero } from '@/components/integrations/OutboxListHero';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SuccessState,
} from '@/components/ui';
import { useOutboxList } from '@/hooks/useOutboxList';
import { OUTBOX_STATUS_LABELS } from '@/types/modules/integrations';
import { colors, spacing, typography } from '@/theme';

export function OutboxListScreen() {
  const router = useRouter();
  const { items, loading, error, refresh, retry, retryLoading, successMessage } = useOutboxList();

  return (
    <ScreenShell
      title="Outbox"
      subtitle="Ausgehende Nachrichten & Webhooks"
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      {loading && items.length === 0 ? (
        <LoadingState message="Outbox wird geladen…" />
      ) : error && items.length === 0 ? (
        <ErrorState title="Fehler" message={error} onRetry={refresh} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
          }
          contentContainerStyle={styles.scroll}
        >
          <OutboxListHero items={items} />
          {successMessage ? <SuccessState message={successMessage} /> : null}
          {items.length === 0 ? (
            <EmptyState title="Leer" message="Keine ausstehenden Einträge." />
          ) : (
            items.map((entry) => (
              <PremiumCard
                key={entry.id}
                accentColor={entry.status === 'failed' ? colors.danger : undefined}
              >
                <View style={styles.row}>
                  <Text style={styles.title}>{entry.subject ?? entry.type.toUpperCase()}</Text>
                  <PremiumBadge
                    label={OUTBOX_STATUS_LABELS[entry.status]}
                    variant={entry.status === 'failed' ? 'red' : 'muted'}
                  />
                </View>
                <Text style={styles.meta}>An: {entry.recipient}</Text>
                <Text style={styles.body} numberOfLines={2}>
                  {entry.body}
                </Text>
                {entry.status === 'failed' ? (
                  <PremiumButton
                    title="Erneut senden"
                    size="sm"
                    variant="secondary"
                    onPress={() => retry(entry.id)}
                    loading={retryLoading}
                  />
                ) : null}
              </PremiumCard>
            ))
          )}
        </ScrollView>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xs },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, color: colors.textSecondary },
  body: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
});
