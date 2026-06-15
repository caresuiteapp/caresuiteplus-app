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
import { useResidentDetail } from '@/hooks/useResidentDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type ResidentDetailSummaryPanelProps = {
  residentId: string;
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ResidentDetailSummaryPanel({ residentId }: ResidentDetailSummaryPanelProps) {
  const router = useRouter();
  const { isReadOnly, roleLabel } = usePermissions();
  const { data: resident, loading, error, refresh, notFound } = useResidentDetail(residentId);

  if (loading) {
    return <LoadingState message="Bewohner:in wird geladen…" />;
  }

  if (notFound || error) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Die Bewohner:in existiert nicht.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!resident) return null;

  const fullName = `${resident.firstName} ${resident.lastName}`;

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={colors.violet}>
        <Text style={styles.title}>{fullName}</Text>
        <Text style={styles.room}>{resident.roomName}</Text>
        <View style={styles.badges}>
          <PremiumBadge
            label={WORKFLOW_STATUS_LABELS[resident.status]}
            variant={statusVariant(resident.status)}
            dot
          />
          {resident.careLevel ? (
            <PremiumBadge label={resident.careLevel} variant="muted" />
          ) : null}
        </View>
        <Text style={styles.hint}>{resident.nextActionHint}</Text>
      </PremiumCard>

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Bewohner:innen einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      <SectionPanel title="Unterbringung">
        <DetailInfoRow label="Zimmer" value={resident.roomName} />
        {resident.wing ? <DetailInfoRow label="Wohnbereich" value={resident.wing} /> : null}
        <DetailInfoRow label="Aufnahme" value={formatDate(resident.admissionDate)} />
      </SectionPanel>

      {resident.notes ? (
        <SectionPanel title="Notizen">
          <Text style={styles.notes} numberOfLines={4}>
            {resident.notes}
          </Text>
        </SectionPanel>
      ) : null}

      <PremiumButton
        title="Vollständige Akte öffnen"
        fullWidth
        onPress={() => router.push(`/stationaer/bewohner/${residentId}` as never)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: spacing.md, gap: spacing.md },
  title: { ...typography.h2, marginBottom: spacing.xs },
  room: { ...typography.caption, color: colors.violet, marginBottom: spacing.sm },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  hint: { ...typography.caption, color: colors.textMuted },
  notes: { ...typography.body },
});
