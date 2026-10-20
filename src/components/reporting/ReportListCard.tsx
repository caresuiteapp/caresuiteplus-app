import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { REPORT_CATEGORY_LABELS } from '@/lib/reporting/reportListStats';
import type { ReportListItem } from '@/types/reporting';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type ReportListCardProps = {
  report: ReportListItem;
  onPress?: () => void;
  selected?: boolean;
};

function statusVariant(status: ReportListItem['status']) {
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
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ReportListCard({ report, onPress, selected = false }: ReportListCardProps) {
  const inner = (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{report.title}</Text>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[report.status]}
          variant={statusVariant(report.status)}
          dot
        />
      </View>
      <Text style={styles.meta}>
        {REPORT_CATEGORY_LABELS[report.category]} · {report.period}
      </Text>
      <Text style={styles.date}>Aktualisiert: {formatDate(report.updatedAt)}</Text>
    </>
  );

  if (!onPress) {
    return <PremiumCard style={styles.card}>{inner}</PremiumCard>;
  }

  return (
    <Pressable onPress={onPress}>
      <PremiumCard
        accentColor={colors.cyan}
        style={[styles.card, selected ? styles.cardSelected : null]}
      >
        {inner}
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  cardSelected: {
    borderColor: colors.cyan,
    borderWidth: 2,
    backgroundColor: 'rgba(98,243,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: 4,
  },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, marginBottom: 4 },
  date: { ...typography.caption, color: colors.textMuted },
});
