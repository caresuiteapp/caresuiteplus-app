import { StyleSheet, Text, View } from 'react-native';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { CarePlanListItem } from '@/types/modules/pflege';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { colors, typography } from '@/theme';

type CarePlansListTableProps = {
  plans: CarePlanListItem[];
  selectedId?: string | null;
  onPlanPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  onOpenMeasures?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function statusVariant(status: CarePlanListItem['status']) {
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

export function CarePlansListTable({
  plans,
  selectedId = null,
  onPlanPress,
  onOpenDetail,
  onOpenMeasures,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: CarePlansListTableProps) {
  const tableText = useTableTextStyles();

  return (
    <PremiumDataTable
      data={plans}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={onPlanPress ? (item) => onPlanPress(item.id) : undefined}
      columns={[
        {
          key: 'title',
          label: 'Titel',
          flex: 1.6,
          render: (item) => <Text style={tableText.title}>{item.title}</Text>,
        },
        {
          key: 'client',
          label: 'Klient:in',
          flex: 1.4,
          sortable: true,
          render: (item) => <Text style={tableText.name}>{item.clientName}</Text>,
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
          key: 'careLevel',
          label: 'Pflegegrad',
          flex: 0.9,
          render: (item) => (
            <Text style={tableText.cellText}>{item.careLevel ? formatCareLevel(item.careLevel) : '—'}</Text>
          ),
        },
        {
          key: 'alerts',
          label: 'Evaluation fällig',
          flex: 1.1,
          align: 'right',
          render: (item) => (
            <Text style={item.alertCount > 0 ? styles.alertCount : tableText.cellText}>
              {item.alertCount > 0 ? item.alertCount : '—'}
            </Text>
          ),
        },
        {
          key: 'updated',
          label: 'Aktualisiert',
          flex: 1.1,
          render: (item) => (
            <Text style={styles.time} numberOfLines={1}>
              {formatDate(item.updatedAt)}
            </Text>
          ),
        },
        {
          key: 'actions',
          label: 'Aktionen',
          flex: 1.8,
          align: 'right',
          render: (item) => (
            <View style={styles.actions}><PremiumButton
              title="Plan"
              accessibilityLabel={`Plan ${item.title} öffnen`}
              size="sm"
              variant="ghost"
              onPress={() => {
                if (onOpenDetail) {
                  onOpenDetail(item.id);
                  return;
                }
                onPlanPress?.(item.id);
              }}
            />{onOpenMeasures ? <PremiumButton title="Maßnahmen" accessibilityLabel={`Maßnahmen für ${item.title} öffnen`} size="sm" variant="ghost" onPress={() => onOpenMeasures(item.id)} /> : null}</View>
          ),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, justifyContent: 'flex-end' },
  alertCount: { ...typography.bodyStrong, color: colors.danger },
  time: { ...typography.caption, color: colors.cyan },
});
