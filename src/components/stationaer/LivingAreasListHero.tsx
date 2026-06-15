import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame, DesktopListViewToggle } from '@/components/ui';
import type { DesktopListViewMode } from '@/components/ui/DesktopListViewToggle';
import { buildLivingAreasListKpis } from '@/lib/stationaer/livingAreasStats';
import { isStationaerExtensionLiveReady, STATIONAER_EXTENSION_PREPARED_MESSAGE } from '@/lib/stationaer/stationaerModuleConfig';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import type { LivingAreaListItem } from '@/types/modules/stationaer';
import { designTokens, spacing } from '@/theme';

type LivingAreasListHeroProps = {
  items: LivingAreaListItem[];
  roleKey: RoleKey;
  viewMode?: DesktopListViewMode;
  onViewModeChange?: (mode: DesktopListViewMode) => void;
  showViewToggle?: boolean;
};

export function LivingAreasListHero({
  items,
  roleKey,
  viewMode = 'cards',
  onViewModeChange,
  showViewToggle = false,
}: LivingAreasListHeroProps) {
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
    color: colors.violet,
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
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  iconText: {
    fontSize: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  preparedHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
}),
    [colors, typography, gradients],
  );


  const kpis = buildLivingAreasListKpis(items, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>STATIONÄR</Text>
          <Text style={styles.title}>Wohnbereiche & Zimmer</Text>
          <Text style={styles.meta}>
            {items.length} Bereiche · Belegung und freie Betten im Überblick
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🛏️</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        {!isStationaerExtensionLiveReady() ? (
          <PremiumBadge label="Demo-funktional" variant="orange" dot />
        ) : null}
      </View>
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
      {!isStationaerExtensionLiveReady() ? (
        <Text style={styles.preparedHint}>{STATIONAER_EXTENSION_PREPARED_MESSAGE}</Text>
      ) : null}
      {showViewToggle && onViewModeChange ? (
        <DesktopListViewToggle value={viewMode} onChange={onViewModeChange} />
      ) : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

