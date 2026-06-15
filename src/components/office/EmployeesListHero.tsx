import { StyleSheet, Text, View } from 'react-native';
import {
  DesktopListViewToggle,
  CareLightButton,
  CareLightKpiCard,
  CareLightListHeroFrame,
  PremiumBadge,
  type DesktopListViewMode,
} from '@/components/ui';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { moduleColor } from '@/design/tokens/modules';
import type { EmployeeListKpi } from '@/data/demo/employeeListStats';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import { designTokens } from '@/theme';

type EmployeesListHeroProps = {
  kpis: EmployeeListKpi[];
  roleKey: RoleKey;
  filteredCount: number;
  totalCount: number;
  canCreate: boolean;
  isReadOnly: boolean;
  onCreatePress?: () => void;
  compact?: boolean;
  viewMode?: DesktopListViewMode;
  onViewModeChange?: (mode: DesktopListViewMode) => void;
  showViewToggle?: boolean;
};

export function EmployeesListHero({
  kpis,
  roleKey,
  filteredCount,
  totalCount,
  canCreate,
  isReadOnly,
  onCreatePress,
  compact = false,
  viewMode = 'table',
  onViewModeChange,
  showViewToggle = false,
}: EmployeesListHeroProps) {
  const accent = moduleColor('office');

  return (
    <CareLightListHeroFrame accentColor={accent}>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>OFFICE</Text>
          <Text style={styles.title}>Mitarbeitende</Text>
          <Text style={styles.meta}>
            {filteredCount} von {totalCount} Einträgen
            {isReadOnly ? ' · Lesemodus' : ''}
          </Text>
        </View>
        {!compact ? (
          <View style={[styles.iconBadge, { backgroundColor: `${accent}18` }]}>
            <Text style={styles.iconText}>👤</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
      </View>
      {showViewToggle && onViewModeChange ? (
        <DesktopListViewToggle value={viewMode} onChange={onViewModeChange} />
      ) : null}
      {!compact ? (
        <View style={styles.kpiRow}>
          {kpis.map((kpi) => (
            <CareLightKpiCard
              key={kpi.id}
              label={kpi.label}
              value={String(kpi.value)}
              subValue={kpi.subValue}
              icon={kpi.icon}
              accentColor={kpi.accentColor}
              style={styles.kpiItem}
            />
          ))}
        </View>
      ) : null}
      {canCreate ? (
        <CareLightButton title="➕ Mitarbeitende anlegen" onPress={onCreatePress} accentColor={accent} />
      ) : null}
    </CareLightListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: careSpacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...careTypography.caption,
    color: careLightColors.cyan,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
    fontWeight: '700',
  },
  title: { ...careTypography.h2, color: careLightColors.navy },
  meta: { ...careTypography.caption, color: careLightColors.muted },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: careLightColors.border,
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
});

