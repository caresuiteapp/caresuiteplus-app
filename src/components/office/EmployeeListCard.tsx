import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { EmployeeListAvatar } from './EmployeeListAvatar';
import type { EmployeeListItem } from '@/types/modules/employeeList';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useTableTextStyles } from '@/design/tokens/auroraGlass';
import { colors, spacing } from '@/theme';

type EmployeeListCardProps = {
  employee: EmployeeListItem;
  onPress?: () => void;
  selected?: boolean;
};

function resolveEmployeePosition(employee: EmployeeListItem): 'Alltagsbegleitung' | 'Büro' | 'Geschäftsführung' {
  const source = `${employee.department ?? ''} ${employee.jobTitle ?? ''}`.toLocaleLowerCase('de-DE');
  if (/geschäftsführ|geschaeftsfuehr|geschäftsleitung|geschaeftsleitung|ceo/.test(source)) {
    return 'Geschäftsführung';
  }
  if (/büro|buero|verwaltung|office|backoffice|disposition/.test(source)) {
    return 'Büro';
  }
  return 'Alltagsbegleitung';
}

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
  const position = resolveEmployeePosition(employee);
  const updatedAt = employee.updatedAt
    ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'short' }).format(new Date(employee.updatedAt))
    : null;
  const facts = [
    { label: 'Position', value: position },
    { label: 'Handynummer', value: employee.phone },
    { label: 'Aktualisiert', value: updatedAt },
  ].filter((fact) => Boolean(fact.value));

  const inner = (
    <View style={styles.cardContent}>
      <View style={styles.identityRow}>
        <EmployeeListAvatar
          firstName={employee.firstName}
          lastName={employee.lastName}
          avatarUrl={employee.avatarUrl}
        />
        <View style={styles.main}>
          <Text style={tableText.name}>{fullName}</Text>
          <Text style={tableText.meta}>{position}</Text>
        </View>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[employee.status]}
          variant={statusVariant(employee.status)}
          dot
        />
      </View>
      {facts.length > 0 ? (
        <View style={styles.factGrid}>
          {facts.map((fact) => (
            <View key={fact.label} style={styles.fact}>
              <Text style={styles.factLabel}>{fact.label}</Text>
              <Text style={tableText.meta} numberOfLines={1}>{fact.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
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
  cardContent: { gap: spacing.md },
  identityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  main: { flex: 1, gap: 2, minWidth: 0 },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fact: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 130,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.13)',
    gap: 2,
  },
  factLabel: {
    color: 'rgba(248,246,255,0.72)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
