import { StyleSheet, Text } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable } from '@/components/ui';
import type { CourseListItem } from '@/types/modules/akademie';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, typography } from '@/theme';

type CoursesListTableProps = {
  courses: CourseListItem[];
  selectedId?: string | null;
  onCoursePress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  sortColumnKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortColumn?: (columnKey: string) => void;
};

function statusVariant(status: CourseListItem['status']) {
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

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} Std. ${rest} Min.` : `${hours} Std.`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function CoursesListTable({
  courses,
  selectedId = null,
  onCoursePress,
  onOpenDetail,
  sortColumnKey = null,
  sortDirection = 'asc',
  onSortColumn,
}: CoursesListTableProps) {
  return (
    <PremiumDataTable
      data={courses}
      keyExtractor={(item) => item.id}
      selectedId={selectedId}
      sortColumnKey={sortColumnKey}
      sortDirection={sortDirection}
      onSortColumn={onSortColumn}
      onRowPress={
        onCoursePress
          ? (item) => onCoursePress(item.id)
          : undefined
      }
      columns={[
        {
          key: 'title',
          label: 'Titel',
          flex: 2,
          sortable: true,
          render: (item) => (
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
          ),
        },
        {
          key: 'status',
          label: 'Status',
          flex: 1.2,
          render: (item) => (
            <PremiumBadge
              label={WORKFLOW_STATUS_LABELS[item.status]}
              variant={statusVariant(item.status)}
              dot
            />
          ),
        },
        {
          key: 'category',
          label: 'Kategorie',
          flex: 1.2,
          render: (item) => (
            <Text style={styles.cellText} numberOfLines={1}>
              {item.category}
            </Text>
          ),
        },
        {
          key: 'duration',
          label: 'Dauer',
          flex: 0.9,
          render: (item) => (
            <Text style={styles.cellText}>{formatDuration(item.durationMinutes)}</Text>
          ),
        },
        {
          key: 'enrollment',
          label: 'Teilnehmende',
          flex: 1,
          render: (item) => (
            <Text style={styles.cellText}>{item.enrollmentCount}</Text>
          ),
        },
        {
          key: 'start',
          label: 'Start',
          flex: 1,
          sortable: true,
          render: (item) => (
            <Text style={styles.cellText}>{formatDate(item.startsAt)}</Text>
          ),
        },
        {
          key: 'actions',
          label: 'Aktionen',
          width: 100,
          align: 'right',
          render: (item) => (
            <PremiumButton
              title="Kurs"
              size="sm"
              variant="ghost"
              onPress={() => {
                if (onOpenDetail) {
                  onOpenDetail(item.id);
                  return;
                }
                onCoursePress?.(item.id);
              }}
            />
          ),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.bodyStrong,
  },
  cellText: {
    ...typography.body,
  },
  muted: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
