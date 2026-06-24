import { StyleSheet, Text, View } from 'react-native';
import {
  DesktopListViewToggle,
  PremiumButton,
  PremiumKpiCard,
  PremiumListHeroFrame,
  PremiumBadge,
  type DesktopListViewMode,
} from '@/components/ui';
import type { ClientListKpi } from '@/lib/office/clientListStats';
import { ROLE_LABELS } from '@/data/constants';
import { useListHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { moduleColor } from '@/design/tokens/modules';

import type { RoleKey } from '@/types';
import { designTokens } from '@/theme';

type ClientsListHeroProps = {
  kpis: ClientListKpi[];
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

export function ClientsListHero({
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
}: ClientsListHeroProps) {
  const accent = moduleColor('office');
  const heroText = useListHeroTextStyles();

  return (
    <PremiumListHeroFrame accentColor={accent} style={compact ? styles.compactFrame : undefined}>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={[heroText.title, compact && styles.compactTitle]}>Klient:innen</Text>
          <Text style={heroText.meta}>
            {filteredCount} von {totalCount} Einträgen
            {isReadOnly ? ' · Lesemodus' : ''}
          </Text>
        </View>
        {!compact ? (
          <View style={[styles.iconBadge, heroText.iconBorder, { backgroundColor: `${accent}18` }]}>
            <Text style={styles.iconText}>👥</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="cyan" dot />
      </View>
      {showViewToggle && onViewModeChange ? (
        <DesktopListViewToggle value={viewMode} onChange={onViewModeChange} />
      ) : null}
      <View style={[styles.kpiRow, compact && styles.kpiRowCompact]}>
        {kpis.map((kpi) => (
          <PremiumKpiCard
            key={kpi.id}
            label={kpi.label}
            value={String(kpi.value)}
            subValue={kpi.subValue}
            icon={kpi.icon}
            accentColor={kpi.accentColor}
            style={compact ? styles.kpiItemCompact : styles.kpiItem}
            variant="light"
          />
        ))}
      </View>
      <View style={styles.actions}>
        {canCreate ? (
          <PremiumButton
            title="Klient:in anlegen"
            onPress={onCreatePress}
            size="sm"
            style={styles.actionBtn}
          />
        ) : null}
        {canCsv && onCsvPress ? (
          <PremiumButton title="CSV Import / Export" variant="secondary" size="sm" onPress={onCsvPress} style={styles.actionBtn} />
        ) : null}
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

const styles = StyleSheet.create({
  compactFrame: {
    marginBottom: careSpacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    gap: careSpacing.md,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  compactTitle: {
    fontSize: 20,
  },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  iconText: {
    fontSize: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
  },
  kpiRowCompact: {
    gap: careSpacing.xs,
  },
  kpiItem: {
    flex: 1,
    minWidth: 100,
  },
  kpiItemCompact: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 72,
    maxWidth: 140,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
  },
  actionBtn: {
    flexGrow: 1,
    minWidth: 140,
  },
});
