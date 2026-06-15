import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useCounselingCaseDetail } from '@/hooks/useCounselingCaseDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type CaseDetailSummaryPanelProps = {
  caseId: string;
};

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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CaseDetailSummaryPanel({ caseId }: CaseDetailSummaryPanelProps) {
  const router = useRouter();
  const { isReadOnly, roleLabel } = usePermissions();
  const { data: counselingCase, loading, error, refresh, notFound } = useCounselingCaseDetail(caseId);

  if (loading) {
    return <LoadingState message="Fall wird geladen…" />;
  }

  if (notFound || error) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Beratungsfall existiert nicht.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!counselingCase) return null;

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={colors.cyan}>
        <Text style={styles.title}>{counselingCase.subject}</Text>
        <Text style={styles.category}>{counselingCase.category}</Text>
        <View style={styles.badges}>
          <PremiumBadge
            label={WORKFLOW_STATUS_LABELS[counselingCase.status]}
            variant={statusVariant(counselingCase.status)}
            dot
          />
        </View>
        <Text style={styles.hint}>{counselingCase.nextActionHint}</Text>
      </PremiumCard>

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Fälle einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      <SectionPanel title="Beteiligte">
        <DetailInfoRow label="Klient:in" value={counselingCase.clientName} />
        <DetailInfoRow label="Berater:in" value={counselingCase.counselorName} />
      </SectionPanel>

      <SectionPanel title="Termine">
        <DetailInfoRow label="Eröffnet" value={formatDateTime(counselingCase.openedAt)} />
        {counselingCase.nextAppointmentAt ? (
          <DetailInfoRow
            label="Nächster Termin"
            value={formatDateTime(counselingCase.nextAppointmentAt)}
          />
        ) : null}
      </SectionPanel>

      {counselingCase.summary ? (
        <SectionPanel title="Zusammenfassung">
          <Text style={styles.summary} numberOfLines={4}>
            {counselingCase.summary}
          </Text>
        </SectionPanel>
      ) : null}

      <PremiumButton
        title="Vollständige Fallakte öffnen"
        fullWidth
        onPress={() => router.push(`/beratung/cases/${caseId}` as never)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: spacing.md, gap: spacing.md },
  title: { ...typography.h2, marginBottom: spacing.xs },
  category: { ...typography.caption, color: colors.cyan, marginBottom: spacing.sm },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  hint: { ...typography.caption, color: colors.textMuted },
  summary: { ...typography.body },
});
