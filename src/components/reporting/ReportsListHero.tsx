import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import {
  DesktopListViewToggle,
  PremiumBadge,
  PremiumKpiCard,
  PremiumListHeroFrame,
} from '@/components/ui';
import type { DesktopListViewMode } from '@/components/ui/DesktopListViewToggle';
import type { ReportListKpi } from '@/lib/reporting/reportListStats';
import { ROLE_LABELS } from '@/data/constants';
import {
  isReportsListLiveReady,
  REPORTS_LIST_PREPARED_MESSAGE,
} from '@/lib/reporting/reportingModuleConfig';

import type { RoleKey } from '@/types';
import { designTokens, spacing } from '@/theme';

type ReportsListHeroProps = {
  kpis: ReportListKpi[];
  roleKey: RoleKey;
  filteredCount: number;
  totalCount: number;
  isReadOnly: boolean;
  compact?: boolean;
  viewMode?: DesktopListViewMode;
  onViewModeChange?: (mode: DesktopListViewMode) => void;
  showViewToggle?: boolean;
};

export function ReportsListHero({
  kpis,
  roleKey,
  filteredCount,
  totalCount,
  isReadOnly,
  compact = false,
  viewMode = 'table',
  onViewModeChange,
  showViewToggle = false,
}: ReportsListHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.cyan,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: {
    ...typography.h2,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(98,243,255,0.35)',
  },
  iconText: {
    fontSize: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  preparedHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiItem: {
    flex: 1,
    minWidth: 100,
  },
}),
    [colors, typography, gradients],
  );


  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>BUSINESS</Text>
          <Text style={styles.title}>Berichte</Text>
          <Text style={styles.meta}>
            {filteredCount} von {totalCount} Berichten
            {isReadOnly ? ' · Lesemodus' : ''}
          </Text>
        </View>
        {!compact ? (
          <View style={styles.iconBadge}>
            <Text style={styles.iconText}>📊</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isReportsListLiveReady() ? (
          <PremiumBadge label="Live Supabase" variant="green" dot />
        ) : (
          <PremiumBadge label="Demo / preparedOnly" variant="muted" />
        )}
      </View>
      {showViewToggle && onViewModeChange ? (
        <DesktopListViewToggle value={viewMode} onChange={onViewModeChange} />
      ) : null}
      {!isReportsListLiveReady() && !compact ? (
        <Text style={styles.preparedHint}>{REPORTS_LIST_PREPARED_MESSAGE}</Text>
      ) : null}
      {!compact ? (
        <View style={styles.kpiRow}>
          {kpis.map((kpi) => (
            <PremiumKpiCard
              key={kpi.id}
              label={kpi.label}
              value={kpi.value}
              subValue={kpi.subValue}
              icon={kpi.icon}
              accentColor={kpi.accentColor}
              style={styles.kpiItem}
            />
          ))}
        </View>
      ) : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

