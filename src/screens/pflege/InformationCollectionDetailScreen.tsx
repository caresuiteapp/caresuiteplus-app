import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumCard, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchInformationCollectionDetail } from '@/lib/pflege/informationCollectionService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { colors, spacing, typography } from '@/theme';

export function InformationCollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const [assessorNote, setAssessorNote] = useState('');

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !id) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      return fetchInformationCollectionDetail(tenantId, id, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id },
  );

  if (query.loading) {
    return (
      <ScreenShell title="Informationssammlung" subtitle="Detail">
        <LoadingState message="Wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error || !query.data) {
    return (
      <ScreenShell title="Informationssammlung" subtitle="Fehler">
        <ErrorState message={query.error ?? 'Nicht gefunden.'} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const item = query.data;

  return (
    <ScreenShell title={item.clientName} subtitle={`${item.collectionType} · ${roleLabel ?? 'Demo'}`}>
      <PremiumCard style={styles.card}>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{item.status}</Text>
        <Text style={styles.label}>Vollständigkeit</Text>
        <Text style={styles.value}>{item.completenessPercent} %</Text>
        <Text style={styles.label}>Offene Punkte</Text>
        <Text style={styles.value}>{item.openItemsCount}</Text>
        {item.openItemsCount === 0 ? (
          <EmptyState
            title="Vollständig erfasst"
            message="Alle Pflichtfelder der Informationssammlung sind ausgefüllt."
          />
        ) : null}
        <PremiumInput
          label="Ergänzende Notiz"
          placeholder="Offene Punkte oder Rücksprache dokumentieren…"
          value={assessorNote}
          onChangeText={setAssessorNote}
          multiline
        />
        <Text style={styles.label}>Erfasst am</Text>
        <Text style={styles.value}>{formatDate(item.collectedAt)}</Text>
        <Text style={styles.label}>Bearbeitende Person</Text>
        <Text style={styles.value}>{item.assessorName}</Text>
      </PremiumCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { margin: spacing.md, gap: spacing.xs },
  label: { ...typography.caption, color: colors.textMuted },
  value: { ...typography.body, marginBottom: spacing.sm },
});
