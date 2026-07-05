import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { lightSurfaceText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, PremiumButton } from '@/components/ui';
import { dialPhoneNumber } from '@/components/portal/EmployeePortalClientRecordContactActions';
import { useEmployeePortalClientRecords } from '@/hooks/useEmployeePortalClientRecords';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

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
  const text = lightSurfaceText;
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
        Nur-Lese-Ansicht — tippen Sie auf eine Akte für alle Details, Dokumente und Anruf-Links.
      </Text>
      {records.map((record) => {
        const location = [record.street, [record.zip, record.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        const phone = record.mobile ?? record.phone;

        return (
          <Pressable
            key={record.clientId}
            onPress={() => router.push(`/portal/employee/clients/${record.clientId}` as never)}
            style={[styles.cardPressable, webCursor]}
            accessibilityRole="button"
            accessibilityLabel={`Klientenakte ${record.displayName} öffnen`}
          >
            <PremiumCard style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.titleCol}>
                  <Text style={[styles.title, { color: text.primary }]}>{record.displayName}</Text>
                  {location ? (
                    <Text style={[styles.subtitle, { color: text.secondary }]} numberOfLines={2}>
                      {location}
                    </Text>
                  ) : null}
                </View>
                {record.careGradeLabel ? (
                  <PremiumBadge label={record.careGradeLabel} variant="cyan" />
                ) : null}
              </View>

              <View style={styles.metaRow}>
                {record.nextAssignmentAt ? (
                  <Text style={[styles.meta, { color: text.muted }]}>
                    Nächster Einsatz: {formatDate(record.nextAssignmentAt)}
                  </Text>
                ) : null}
                {record.activeAssignmentCount > 0 ? (
                  <PremiumBadge
                    label={`${record.activeAssignmentCount} aktiv`}
                    variant="green"
                  />
                ) : null}
              </View>

              {record.hints ? (
                <Text style={[styles.hintLine, { color: text.secondary }]} numberOfLines={2}>
                  {record.hints}
                </Text>
              ) : null}

              <View style={styles.actions}>
                {phone ? (
                  <PremiumButton
                    title="Anrufen"
                    size="sm"
                    variant="secondary"
                    onPress={() => dialPhoneNumber(phone)}
                  />
                ) : null}
                <PremiumButton
                  title="Akte öffnen"
                  size="sm"
                  variant={phone ? 'ghost' : 'secondary'}
                  onPress={() => router.push(`/portal/employee/clients/${record.clientId}` as never)}
                />
              </View>
            </PremiumCard>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.md,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  hint: {
    ...careTypography.caption,
    marginBottom: careSpacing.xs,
  },
  cardPressable: { width: '100%' },
  card: { gap: careSpacing.sm },
  cardHeader: { flexDirection: 'row', gap: careSpacing.sm, alignItems: 'flex-start' },
  titleCol: { flex: 1, gap: 4, minWidth: 0 },
  title: { ...careTypography.h3 },
  subtitle: { ...careTypography.body },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, alignItems: 'center' },
  meta: { ...careTypography.caption },
  hintLine: { ...careTypography.caption, fontStyle: 'italic' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, marginTop: careSpacing.xs },
});
