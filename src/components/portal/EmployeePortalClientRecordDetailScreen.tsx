import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { DetailInfoRow } from '@/components/detail';
import { EmptyState, ErrorState, LoadingState, SectionPanel } from '@/components/ui';
import { useEmployeePortalClientRecordDetail } from '@/hooks/useEmployeePortalClientRecords';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function EmployeePortalClientRecordDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const clientId = Array.isArray(rawId) ? rawId[0] : rawId;
  const text = useAuroraAdaptiveText();
  const { record, loading, error, refresh, notFound } = useEmployeePortalClientRecordDetail(clientId);

  if (loading) {
    return <LoadingState message="Klientenakte wird geladen…" />;
  }

  if (notFound || error) {
    return (
      <ErrorState
        title="Klientenakte"
        message={error ?? 'Klient:in nicht gefunden oder kein Zugriff.'}
        onRetry={refresh}
      />
    );
  }

  if (!record) return null;

  const address = [record.street, [record.zip, record.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={[styles.readOnlyHint, { color: text.muted }]}>
        Nur-Lese-Ansicht — keine Bearbeitung möglich.
      </Text>

      <SectionPanel title="Stammdaten">
        <DetailInfoRow label="Name" value={record.displayName} />
        {address ? <DetailInfoRow label="Adresse" value={address} /> : null}
        {record.phone ? <DetailInfoRow label="Telefon" value={record.phone} /> : null}
        {record.careGrade ? <DetailInfoRow label="Pflegegrad" value={record.careGrade} /> : null}
      </SectionPanel>

      {record.emergencyContact ? (
        <SectionPanel title="Notfallkontakt">
          <Text style={[styles.body, { color: text.secondary }]}>{record.emergencyContact}</Text>
        </SectionPanel>
      ) : null}

      {record.accessHint ? (
        <SectionPanel title="Zugang / Hinweise">
          <Text style={[styles.body, { color: text.secondary }]}>{record.accessHint}</Text>
        </SectionPanel>
      ) : null}

      {record.hints ? (
        <SectionPanel title="Besonderheiten">
          <Text style={[styles.body, { color: text.secondary }]}>{record.hints}</Text>
        </SectionPanel>
      ) : null}

      {record.portalDocuments.length > 0 ? (
        <SectionPanel title="Freigegebene Dokumente">
          {record.portalDocuments.map((doc) => (
            <Text key={doc.id} style={[styles.body, { color: text.secondary }]}>
              {doc.title}
              {doc.category ? ` (${doc.category})` : ''}
            </Text>
          ))}
        </SectionPanel>
      ) : null}

      <SectionPanel title="Einsatzhistorie">
        {record.assignmentHistory.length === 0 ? (
          <EmptyState title="Keine Einsätze" message="Noch keine Einsätze für diese:n Klient:in." />
        ) : (
          record.assignmentHistory.map((entry) => (
            <View key={entry.assignmentId} style={styles.historyRow}>
              <Text style={[styles.historyTitle, { color: text.primary }]}>{entry.title}</Text>
              <Text style={[styles.historyMeta, { color: text.muted }]}>
                {formatDateTime(entry.plannedStartAt)} · {entry.status}
              </Text>
            </View>
          ))
        )}
      </SectionPanel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: careSpacing.md,
    paddingBottom: careSpacing.xxl,
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  readOnlyHint: { ...careTypography.caption, fontStyle: 'italic' },
  body: { ...careTypography.body },
  historyRow: { gap: 2, marginBottom: careSpacing.sm },
  historyTitle: { ...careTypography.bodyStrong },
  historyMeta: { ...careTypography.caption },
});
