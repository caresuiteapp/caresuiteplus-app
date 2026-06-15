import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { DesktopListViewToggle, PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import type { DesktopListViewMode } from '@/components/ui/DesktopListViewToggle';
import { buildCareRecordsListKpis } from '@/lib/assist/careRecordsListStats';
import {
  ASSIST_EXTENSION_PREPARED_MESSAGE,
  isAssistTripsLiveReady,
} from '@/lib/assist/assistModuleConfig';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import type { CareRecordListItem } from '@/types/modules/assist';
import type { RoleKey } from '@/types';
import { designTokens, spacing } from '@/theme';

type CareRecordsListHeroProps = {
  items: CareRecordListItem[];
  totalCount: number;
  roleKey: RoleKey;
  viewMode?: DesktopListViewMode;
  onViewModeChange?: (mode: DesktopListViewMode) => void;
  showViewToggle?: boolean;
};

export function CareRecordsListHero({
  items,
  totalCount,
  roleKey,
  viewMode = 'cards',
  onViewModeChange,
  showViewToggle = false,
}: CareRecordsListHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: colors.amber,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: { ...typography.h2 },
  meta: { ...typography.caption, color: colors.textMuted },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,176,32,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  preparedHint: { ...typography.caption, color: colors.textMuted },
}),
    [colors, typography, gradients],
  );


  const kpis = buildCareRecordsListKpis(items, totalCount, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>ASSIST</Text>
          <Text style={styles.title}>Leistungsnachweise</Text>
          <Text style={styles.meta}>Dokumentierte Pflegeleistungen und Signaturen</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📝</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        {isAssistTripsLiveReady() ? (
          <PremiumBadge label="Live Fahrtenbuch" variant="green" />
        ) : (
          <PremiumBadge label="Demo / preparedOnly" variant="muted" />
        )}
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
      <Text style={styles.preparedHint}>{ASSIST_EXTENSION_PREPARED_MESSAGE}</Text>
      {showViewToggle && onViewModeChange ? (
        <DesktopListViewToggle value={viewMode} onChange={onViewModeChange} />
      ) : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

