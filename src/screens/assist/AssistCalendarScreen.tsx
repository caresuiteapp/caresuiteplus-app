import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchCalendarWeek } from '@/lib/assist/calendarService';
import { useRouter } from 'expo-router';
import { AssistCalendarListHero } from '@/components/assist';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, PremiumInput } from '@/components/ui';
import { useAssistCalendar } from '@/hooks/useAssistCalendar';
import { useAuth } from '@/lib/auth/context';
import { colors, spacing, typography } from '@/theme';

export function AssistCalendarScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { data, loading, error, refresh } = useAssistCalendar();
  const roleKey = profile?.roleKey ?? 'caregiver';

  if (loading && !data) {
    return (
      <ScreenShell title="Kalender" subtitle="Einsatzplanung · WP 243">
        <LoadingState message="Wochenübersicht wird geladen…" />
      </ScreenShell>
    );
  }

  if (error) {
    return (
      <ScreenShell title="Kalender" subtitle="Fehler">
        <ErrorState title="Kalender" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  const groups = data ?? [];

  return (
    <ScreenShell title="Kalender" subtitle="Einsatzplanung · WP 243" scroll={false}>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.dateKey}
        ListHeaderComponent={
          <View style={styles.header}>
            <AssistCalendarListHero groups={groups} roleKey={roleKey} />
          </View>
        }
        ListEmptyComponent={<EmptyState title="Keine Einsätze" message="Für diese Woche sind keine Termine geplant." />}
        renderItem={({ item }) => (
          <View style={styles.dayBlock}>
            <Text style={styles.dayLabel}>{item.label}</Text>
            {item.assignments.map((assignment) => (
              <Pressable
                key={assignment.id}
                onPress={() => router.push(`/assist/assignments/${assignment.id}` as never)}
              >
                <PremiumCard style={styles.card}>
                  <Text style={styles.title}>{assignment.clientName}</Text>
                  <Text style={styles.meta}>{assignment.title}</Text>
                  <PremiumBadge label={assignment.status} variant="cyan" />
                </PremiumCard>
              </Pressable>
            ))}
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.sm },
  list: { paddingBottom: spacing.xxl },
  dayBlock: { marginBottom: spacing.lg },
  dayLabel: { ...typography.h3, marginBottom: spacing.sm },
  card: { marginBottom: spacing.sm },
  title: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textSecondary, marginVertical: spacing.xs },
});
