import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AssignmentDetailGlassModal } from '@/components/assist/AssignmentDetailGlassModal';
import { AssistCalendarListHero } from '@/components/assist';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard } from '@/components/ui';
import { useAssistCalendar } from '@/hooks/useAssistCalendar';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { getServiceMode } from '@/lib/services/mode';
import { colors, spacing, typography } from '@/theme';

export function AssistCalendarScreen() {
  const { profile } = useAuth();
  const { isReadOnly, roleLabel } = usePermissions();
  const { data, loading, error, refresh } = useAssistCalendar();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedAssignmentTitle, setSelectedAssignmentTitle] = useState('Einsatz');
  const roleKey = profile?.roleKey ?? 'caregiver';
  const roleSubtitle = getServiceMode() === 'supabase' ? roleLabel ?? 'Assist' : roleLabel ?? 'Demo';

  if (loading && !data) {
    return (
      <CareLightPageShell title="Kalender" subtitle="Wird geladen…" showBack={false} scroll={false}>
        <LoadingState message="Wochenübersicht wird geladen…" />
      </CareLightPageShell>
    );
  }

  if (error) {
    return (
      <CareLightPageShell title="Kalender" subtitle="Fehler" showBack={false} scroll={false}>
        <ErrorState title="Kalender" message={error} onRetry={refresh} />
      </CareLightPageShell>
    );
  }

  const groups = data ?? [];

  return (
    <>
      <CareLightPageShell
        title="Kalender"
        subtitle={`Einsatzplanung${isReadOnly ? ' · Lesemodus' : ''} · ${roleSubtitle}`}
        showBack={false}
        scroll={false}
      >
        <View style={styles.content}>
          <FlatList
            data={groups}
            keyExtractor={(item) => item.dateKey}
            ListHeaderComponent={
              <View style={styles.header}>
                <AssistCalendarListHero groups={groups} roleKey={roleKey} />
              </View>
            }
            ListEmptyComponent={
              <EmptyState title="Keine Einsätze" message="Für diese Woche sind keine Termine geplant." />
            }
            renderItem={({ item }) => (
              <View style={styles.dayBlock}>
                <Text style={styles.dayLabel}>{item.label}</Text>
                {item.assignments.map((assignment) => (
                  <Pressable
                    key={assignment.id}
                    onPress={() => {
                      setSelectedAssignmentId(assignment.id);
                      setSelectedAssignmentTitle(assignment.title);
                    }}
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
        </View>
      </CareLightPageShell>
      <AssignmentDetailGlassModal
        visible={!!selectedAssignmentId}
        assignmentId={selectedAssignmentId}
        title={selectedAssignmentTitle}
        onClose={() => setSelectedAssignmentId(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  header: { marginBottom: spacing.sm },
  list: { paddingBottom: spacing.xxl },
  dayBlock: { marginBottom: spacing.lg },
  dayLabel: { ...typography.h3, marginBottom: spacing.sm },
  card: { marginBottom: spacing.sm },
  title: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textSecondary, marginVertical: spacing.xs },
});
