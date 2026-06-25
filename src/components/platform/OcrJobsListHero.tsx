import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { DesktopListViewToggle, PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import type { DesktopListViewMode } from '@/components/ui/DesktopListViewToggle';
import { ROLE_LABELS } from '@/data/constants';
import { buildOcrJobsListKpis } from '@/lib/platform/platformListStats';
import { isPlatformLiveReady, PLATFORM_PREPARED_MESSAGE } from '@/lib/platform/platformModuleConfig';

import type { RoleKey } from '@/types';
import type { OcrJobListItem } from '@/types/modules/platform';
import { designTokens, spacing } from '@/theme';

type OcrJobsListHeroProps = {
  items: OcrJobListItem[];
  roleKey: RoleKey;
  viewMode?: DesktopListViewMode;
  onViewModeChange?: (mode: DesktopListViewMode) => void;
  showViewToggle?: boolean;
};

export function OcrJobsListHero({
  items,
  roleKey,
  viewMode = 'cards',
  onViewModeChange,
  showViewToggle = false,
}: OcrJobsListHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: heroText.eyebrow,
  title: heroText.title,
  meta: heroText.meta,
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(98,243,255,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  preparedHint: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
}),
    [colors, typography, gradients],
  );


  const kpis = buildOcrJobsListKpis(items, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>OCR-Jobs</Text>
          <Text style={styles.meta}>Azure Document Intelligence · Textextraktion</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📄</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {!isPlatformLiveReady() ? (
          <PremiumBadge label="Provider preparedOnly" variant="muted" />
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
      {!isPlatformLiveReady() ? (
        <Text style={styles.preparedHint}>{PLATFORM_PREPARED_MESSAGE}</Text>
      ) : null}
      {showViewToggle && onViewModeChange ? (
        <DesktopListViewToggle value={viewMode} onChange={onViewModeChange} />
      ) : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

