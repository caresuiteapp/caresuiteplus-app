import { StyleSheet, Text, View } from 'react-native';
import {
  DesktopListViewToggle,
  CareLightKpiCard,
  CareLightListHeroFrame,
  PremiumBadge,
  type DesktopListViewMode,
} from '@/components/ui';
import { useListHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { moduleColor } from '@/design/tokens/modules';
import type { VisitDispositionKpi } from '@/lib/assist/visitService';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import { getServiceMode } from '@/lib/services/mode';
import type { RoleKey } from '@/types';

type AssignmentsListHeroProps = {
  kpis: VisitDispositionKpi[];
  roleKey: RoleKey;
  tenantLabel?: string;
  filteredCount: number;
  totalCount: number;
  isReadOnly: boolean;
  compact?: boolean;
  viewMode?: DesktopListViewMode;
  onViewModeChange?: (mode: DesktopListViewMode) => void;
  showViewToggle?: boolean;
  onCalendarPress?: () => void;
};

export function AssignmentsListHero({
  kpis,
  roleKey,
  tenantLabel,
  filteredCount,
  totalCount,
  isReadOnly,
  compact = false,
  viewMode = 'table',
  onViewModeChange,
  showViewToggle = false,
  onCalendarPress,
}: AssignmentsListHeroProps) {
  const accent = moduleColor('assist');
  const heroText = useListHeroTextStyles();
  const isLive = getServiceMode() === 'supabase';

  return (
    <CareLightListHeroFrame accentColor={accent}>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={heroText.eyebrow}>ASSIST · DISPOSITION</Text>
          <Text style={heroText.title}>Einsatzplanung</Text>
          <Text style={heroText.meta}>
            {filteredCount} von {totalCount} Einsätzen
            {tenantLabel ? ` · ${tenantLabel}` : ''}
            {isReadOnly ? ' · Lesemodus' : ''}
            {isLive ? ' · Live' : ''}
          </Text>
        </View>
        {!compact ? (
          <View style={[styles.iconBadge, heroText.iconBorder, { backgroundColor: `${accent}18` }]}>
            <Text style={styles.iconText}>📋</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        {onCalendarPress ? (
          <PremiumBadge label="Kalender →" variant="muted" />
        ) : null}
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
    </CareLightListHeroFrame>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: careSpacing.md },
  textCol: { flex: 1, gap: 2 },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
});
