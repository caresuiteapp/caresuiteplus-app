import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { EmployeeListAvatar } from './EmployeeListAvatar';
import type { EmployeeListItem } from '@/types/modules/employeeList';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { resolveEmployeeRoleLabel } from '@/lib/office/employeeCatalogLabels';
import { colors, spacing } from '@/theme';

type EmployeeListCardProps = {
  employee: EmployeeListItem;
  onPress?: () => void;
  selected?: boolean;
};

function statusVariant(status: EmployeeListItem['status']) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function EmployeeListCard({ employee, onPress, selected = false }: EmployeeListCardProps) {
  const tableText = useTableTextStyles();
  const fullName = `${employee.firstName} ${employee.lastName}`;

  const inner = (
    <View style={styles.row}>
      <EmployeeListAvatar
        firstName={employee.firstName}
        lastName={employee.lastName}
        avatarUrl={employee.avatarUrl}
      />
      <View style={styles.main}>
        <Text style={tableText.name}>{fullName}</Text>
        <Text style={tableText.meta}>{resolveEmployeeRoleLabel(employee.jobTitle)}</Text>
        {employee.email ? <Text style={tableText.meta}>{employee.email}</Text> : null}
      </View>
      <PremiumBadge
        label={WORKFLOW_STATUS_LABELS[employee.status]}
        variant={statusVariant(employee.status)}
        dot
      />
    </View>
  );

  if (!onPress) {
    return (
      <PremiumCard accentColor={colors.orange} style={styles.card}>
        {inner}
      </PremiumCard>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <PremiumCard
        accentColor={colors.orange}
        style={[styles.card, selected ? styles.cardSelected : null]}
        onPress={onPress}
      >
        {inner}
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  cardSelected: {
    borderColor: colors.orange,
    borderWidth: 2,
    backgroundColor: 'rgba(255,149,0,0.08)',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  main: { flex: 1, gap: 2 },
});
