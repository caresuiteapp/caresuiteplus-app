import { StyleSheet, Text } from 'react-native';
import { PremiumCard } from '@/components/ui';
import type { QmComplianceRequirement } from '@/lib/qm';
import { QmStatusBadge } from './QmStatusBadge';
import { colors, spacing, typography } from '@/theme';

type Props = { item: QmComplianceRequirement; onPress?: () => void };

export function QmComplianceCard({ item, onPress }: Props) {
  return (
    <PremiumCard accentColor={colors.orange} onPress={onPress}>
      <Text style={styles.title}>{item.title}</Text>
      <QmStatusBadge kind="compliance" status={item.status} />
      {item.dueAt && (
        <Text style={styles.due}>Fällig: {new Date(item.dueAt).toLocaleDateString('de-DE')}</Text>
      )}
      <Text style={styles.role}>Verantwortlich: {item.responsibleRole}</Text>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.bodyStrong, marginBottom: spacing.xs },
  due: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  role: { ...typography.caption, color: colors.textMuted },
});
