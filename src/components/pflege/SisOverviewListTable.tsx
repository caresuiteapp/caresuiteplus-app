import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { SisAssessment } from '@/types/modules/pflege';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type SisOverviewListTableProps = {
  items: SisAssessment[];
  selectedId?: string | null;
  onItemPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
};

function statusVariant(status: SisAssessment['status']) {
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

export function SisOverviewListTable({
  items,
  selectedId = null,
  onItemPress,
  onOpenDetail,
}: SisOverviewListTableProps) {
  return (
    <PremiumDataTable
      data={items}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      onRowPress={onItemPress ? (item) => onItemPress(item.id) : undefined}
      columns={[
        {
          key: 'client',
          label: 'Klient:in',
          flex: 1.4,
          render: (item) => <Text style={styles.name}>{item.clientName}</Text>,
        },
        {
          key: 'score',
          label: 'Score',
          flex: 0.8,
          render: (item) => <Text style={styles.score}>{item.overallScore} Pkt.</Text>,
        },
        {
          key: 'status',
          label: 'Status',
          flex: 1.1,
          render: (item) => (
            <PremiumBadge
              label={WORKFLOW_STATUS_LABELS[item.status]}
              variant={statusVariant(item.status)}
              dot
            />
          ),
        },
        {
          key: 'assessed',
          label: 'Bewertet',
          flex: 1.1,
          render: (item) => (
            <Text style={styles.time}>
              {new Date(item.assessedAt).toLocaleDateString('de-DE')}
            </Text>
          ),
        },
        {
          key: 'review',
          label: 'Prüfung',
          flex: 1.1,
          render: (item) => (
            <Text style={styles.time}>
              {item.nextReviewAt
                ? new Date(item.nextReviewAt).toLocaleDateString('de-DE')
                : '—'}
            </Text>
          ),
        },
        {
          key: 'assessor',
          label: 'Assessor:in',
          flex: 1.2,
          render: (item) => (
            <Text style={styles.cellText} numberOfLines={1}>
              {item.assessorName}
            </Text>
          ),
        },
        {
          key: 'actions',
          label: 'Aktionen',
          width: 100,
          align: 'right',
          render: (item) => (
            <PremiumButton
              title="Detail"
              size="sm"
              variant="ghost"
              onPress={() => {
                if (onOpenDetail) {
                  onOpenDetail(item.id);
                  return;
                }
                onItemPress?.(item.id);
              }}
            />
          ),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  name: { ...typography.bodyStrong },
  score: { ...typography.bodyStrong, color: colors.cyan },
  cellText: { ...typography.body },
  time: { ...typography.caption, color: colors.cyan },
});
