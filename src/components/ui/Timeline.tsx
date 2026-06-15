import { StyleSheet, Text, View } from 'react-native';
import type { DashboardActivity } from '@/types/dashboard';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';
import { PremiumBadge } from './PremiumBadge';

type TimelineProps = {
  items: DashboardActivity[];
  maxItems?: number;
  emptyTitle?: string;
  emptyMessage?: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
}

const TYPE_COLORS: Record<DashboardActivity['type'], string> = {
  client: colors.orange,
  employee: colors.violet,
  assignment: colors.orange,
  invoice: colors.amber,
  care: colors.success,
  document: colors.cyan,
  system: colors.textMuted,
};

export function Timeline({
  items,
  maxItems = 6,
  emptyTitle = 'Keine Aktivitäten',
  emptyMessage = 'Hier erscheinen die letzten Vorgänge.',
}: TimelineProps) {
  const visible = items.slice(0, maxItems);

  if (visible.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        <Text style={styles.emptyMessage}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {visible.map((item, index) => (
        <View key={item.id} style={styles.row}>
          <View style={styles.lineCol}>
            <View style={[styles.dot, { backgroundColor: TYPE_COLORS[item.type] }]} />
            {index < visible.length - 1 ? <View style={styles.line} /> : null}
          </View>
          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text style={styles.icon}>{item.icon}</Text>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.time}>{timeAgo(item.timestamp)}</Text>
            </View>
            {item.subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {item.subtitle}
              </Text>
            ) : null}
            {item.status ? (
              <PremiumBadge
                label={WORKFLOW_STATUS_LABELS[item.status]}
                variant={
                  item.status === 'fehlerhaft'
                    ? 'red'
                    : item.status === 'abgeschlossen'
                      ? 'green'
                      : 'muted'
                }
              />
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  lineCol: {
    alignItems: 'center',
    width: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.borderSoft,
    marginTop: 4,
    minHeight: 24,
  },
  content: {
    flex: 1,
    gap: 4,
    paddingBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  title: {
    ...typography.bodyStrong,
    flex: 1,
  },
  time: {
    ...typography.caption,
    color: colors.textMuted,
  },
  subtitle: {
    ...typography.caption,
  },
  empty: {
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.bodyStrong,
  },
  emptyMessage: {
    ...typography.caption,
    textAlign: 'center',
  },
});
