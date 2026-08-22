import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import {
  DesktopListViewToggle,
  PremiumButton,
  type DesktopListViewMode,
} from '@/components/ui';
import type { EmployeeListKpi } from '@/lib/office/employeeListStats';
import type { RoleKey } from '@/types';
import { ROLE_LABELS } from '@/data/constants';
import { spacing, typography } from '@/theme';

type EmployeesListHeroProps = {
  kpis: EmployeeListKpi[];
  roleKey: RoleKey;
  filteredCount: number;
  totalCount: number;
  canCreate: boolean;
  isReadOnly: boolean;
  onCreatePress?: () => void;
  onCsvPress?: () => void;
  canCsv?: boolean;
  compact?: boolean;
  viewMode?: DesktopListViewMode;
  onViewModeChange?: (mode: DesktopListViewMode) => void;
  showViewToggle?: boolean;
};

/** Kompakte Personalübersicht ohne doppelten Seiten-Hero (ersetzt PremiumListHeroFrame). */
export function EmployeesListHero({
  kpis,
  roleKey,
  filteredCount,
  totalCount,
  canCreate,
  isReadOnly,
  onCreatePress,
  onCsvPress,
  canCsv = false,
  compact = false,
  viewMode = 'table',
  onViewModeChange,
  showViewToggle = false,
}: EmployeesListHeroProps) {
  return (
    <View style={styles.surface}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>PERSONALÜBERSICHT</Text>
          <Text style={styles.title}>Team auf einen Blick</Text>
          <Text style={styles.meta}>
            {filteredCount === totalCount
              ? `${totalCount} Mitarbeitende im Unternehmen`
              : `${filteredCount} von ${totalCount} Mitarbeitenden sichtbar`}
            {isReadOnly ? ' · Lesemodus' : ''}
          </Text>
        </View>
        <View style={styles.rolePill}>
          <View style={styles.roleDot} />
          <Text style={styles.roleText}>{ROLE_LABELS[roleKey]}</Text>
        </View>
      </View>

      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <View key={kpi.id} style={styles.kpiCard}>
            <View style={[styles.kpiRail, { backgroundColor: kpi.accentColor }]} />
            <Text style={styles.kpiLabel}>{kpi.label}</Text>
            <Text style={styles.kpiValue}>{kpi.value}</Text>
            <Text style={styles.kpiMeta}>{kpi.subValue ?? 'Keine offenen Hinweise'}</Text>
          </View>
        ))}
      </View>

      <View style={styles.utilityRow}>
        {showViewToggle && onViewModeChange ? (
          <DesktopListViewToggle value={viewMode} onChange={onViewModeChange} />
        ) : <View />}
        <View style={styles.utilityActions}>
          {canCsv && onCsvPress ? (
            <PremiumButton title="CSV Import / Export" variant="secondary" size="sm" onPress={onCsvPress} />
          ) : null}
          {compact && canCreate ? (
            <PremiumButton title="+ Mitarbeitende anlegen" size="sm" onPress={onCreatePress} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    width: '100%', minWidth: 0, padding: spacing.lg, gap: spacing.md,
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(76, 151, 214, 0.34)',
    backgroundColor: 'rgba(248, 252, 255, 0.97)', overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 16px 38px rgba(0, 31, 71, 0.13)' } as unknown as ViewStyle)
      : null),
  },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  headingCopy: { flex: 1, minWidth: 0, gap: 3 },
  eyebrow: { ...typography.caption, color: '#0872D9', fontWeight: '800', letterSpacing: 1.1 },
  title: { ...typography.h2, color: '#08213D', fontWeight: '900' },
  meta: { ...typography.caption, color: '#526A84' },
  rolePill: {
    minHeight: 34, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 7,
    borderRadius: 999, borderWidth: 1, borderColor: 'rgba(8, 114, 217, 0.24)', backgroundColor: '#EAF5FF',
  },
  roleDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#0872D9' },
  roleText: { ...typography.caption, color: '#0759AD', fontWeight: '800' },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiCard: {
    flexGrow: 1, flexBasis: 180, minWidth: 150, minHeight: 92, padding: spacing.md, paddingLeft: spacing.lg,
    borderRadius: 14, borderWidth: 1, borderColor: '#D4E4F2', backgroundColor: '#FFFFFF',
    position: 'relative', overflow: 'hidden',
  },
  kpiRail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  kpiLabel: { ...typography.caption, color: '#60758B', fontWeight: '700' },
  kpiValue: { fontSize: 25, lineHeight: 30, color: '#08213D', fontWeight: '900' },
  kpiMeta: { ...typography.caption, color: '#526A84' },
  utilityRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  utilityActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm },
});
