import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchCarePlanDetail } from '@/lib/pflege/carePlanDetailService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CarePlanDetailHero, VitalReadingListCard } from '@/components/pflege';
import { PflegeCrossModuleLinksPanel } from '@/components/pflege/PflegeCrossModuleLinksPanel';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumButton, PremiumCard, PremiumInput, SectionPanel } from '@/components/ui';
import { useCarePlanDetail } from '@/hooks/useCarePlanDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function statusVariant(status: string) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function CarePlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { isReadOnly, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';

  const {
    data: plan,
    vitals,
    loading,
    error,
    refresh,
    notFound,
  } = useCarePlanDetail(id);

  if (loading) {
    return (
      <CareLightPageShell title="Pflegeplan" subtitle="Wird geladen…">
        <LoadingState message="Pflegeplandetails werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (notFound || error) {
    return (
      <CareLightPageShell title="Pflegeplan" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Pflegeplan existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </CareLightPageShell>
    );
  }

  if (!plan) return null;

  return (
    <CareLightPageShell
      title={plan.title}
      subtitle={`${plan.clientName} · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <CarePlanDetailHero plan={plan} roleKey={roleKey} isReadOnly={isReadOnly} />

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Pflegepläne einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SectionPanel title="Gültigkeit">
          <DetailInfoRow label="Gültig ab" value={formatDate(plan.validFrom)} />
          <DetailInfoRow
            label="Gültig bis"
            value={plan.validUntil ? formatDate(plan.validUntil) : 'Unbefristet'}
          />
          <DetailInfoRow label="Zusammenfassung" value={plan.summary} />
        </SectionPanel>

        <SectionPanel title="Klient:in">
          <DetailInfoRow label="Name" value={plan.clientName} />
          <DetailInfoRow label="Pflegegrad" value={plan.careLevel ?? '—'} />
          <DetailInfoRow label="Wohnort" value={plan.city} />
          <DetailInfoRow label="Zuständige Pflegekraft" value={plan.employeeName} />
        </SectionPanel>

        <SectionPanel title="Pflegeaufgaben" subtitle={`${plan.tasks.length} Aufgaben`}>
          {plan.tasks.length === 0 ? (
            <EmptyState title="Keine Aufgaben" message="Diesem Plan sind keine Aufgaben zugeordnet." />
          ) : (
            plan.tasks.map((task) => (
              <PremiumCard key={task.id} style={styles.taskCard}>
                <View style={styles.taskHeader}>
                  <Text style={styles.taskLabel}>{task.label}</Text>
                  <PremiumBadge
                    label={WORKFLOW_STATUS_LABELS[task.status]}
                    variant={statusVariant(task.status)}
                    dot
                  />
                </View>
                <Text style={styles.taskFreq}>{task.frequency}</Text>
              </PremiumCard>
            ))
          )}
        </SectionPanel>

        <SectionPanel
          title="Vitalwerte"
          subtitle={
            plan.dueVitalsCount > 0
              ? `${plan.dueVitalsCount} fällige Messung(en)`
              : 'Aktuelle Messungen'
          }
        >
          {vitals.length === 0 ? (
            <EmptyState
              title="Keine Vitalwerte"
              message="Für diesen Pflegeplan liegen noch keine Messungen vor."
            />
          ) : (
            vitals.map((reading) => (
              <VitalReadingListCard
                key={reading.id}
                reading={reading}
                onPress={() => router.push(`/pflege/vitalwerte/${reading.id}` as never)}
              />
            ))
          )}
        </SectionPanel>

        <PflegeCrossModuleLinksPanel context="care-plan" />
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  taskCard: { marginBottom: spacing.sm },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: 4,
  },
  taskLabel: { ...typography.bodyStrong, flex: 1 },
  taskFreq: { ...typography.caption, color: colors.cyan },
});
