import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { EmptyState, ErrorState, LoadingState, PremiumListRow } from '@/components/ui';
import { useEmployeePortalClientRecords } from '@/hooks/useEmployeePortalClientRecords';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function EmployeePortalClientRecordsScreen() {
  const router = useRouter();
  const text = useAuroraAdaptiveText();
  const { records, loading, error, refresh } = useEmployeePortalClientRecords();

  if (loading && records.length === 0) {
    return <LoadingState message="Klientenakten werden geladen…" />;
  }

  if (error && records.length === 0) {
    return (
      <ErrorState title="Klientenakten" message={error} onRetry={() => void refresh()} />
    );
  }

  if (records.length === 0) {
    return (
      <EmptyState
        title="Keine Klient:innen"
        message="Ihnen sind aktuell keine Klient:innen über Einsätze zugeordnet."
        actionLabel="Erneut laden"
        onAction={() => void refresh()}
      />
    );
  }

  return (
    <View style={styles.container} testID="employee-portal-client-records">
      <Text style={[styles.hint, { color: text.muted }]}>
        Nur-Lese-Ansicht — Bearbeitung erfolgt im Office.
      </Text>
      {records.map((record, index) => {
        const location = [record.zip, record.city].filter(Boolean).join(' ') || record.street;
        const subtitle = [
          location,
          record.careGrade ? `PG ${record.careGrade}` : null,
          record.nextAssignmentAt ? `Nächster Einsatz: ${formatDate(record.nextAssignmentAt)}` : null,
        ]
          .filter(Boolean)
          .join(' · ');

        return (
          <PremiumListRow
            key={record.clientId}
            title={record.displayName}
            subtitle={subtitle}
            trailing={
              record.activeAssignmentCount > 0 ? (
                <Text style={[styles.activeBadge, { color: text.secondary }]}>
                  {record.activeAssignmentCount} aktiv
                </Text>
              ) : undefined
            }
            showChevron
            showDivider={index < records.length - 1}
            onPress={() => router.push(`/portal/employee/clients/${record.clientId}` as never)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.sm,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  hint: {
    ...careTypography.caption,
    marginBottom: careSpacing.xs,
  },
  activeBadge: { ...careTypography.caption, fontWeight: '600' },
});
