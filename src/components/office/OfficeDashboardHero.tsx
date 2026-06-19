import { useMemo } from 'react';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import { PremiumBadge, PremiumButton, PremiumListHeroFrame } from '@/components/ui';
import { dashboardKpisToGridItems } from '@/lib/adaptive/kpiGridItems';
import {
  isOfficeDashboardLiveReady,
  OFFICE_DASHBOARD_PREPARED_MESSAGE,
} from '@/lib/office/officeModuleConfig';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import type { DashboardQuickAction, DashboardSnapshot } from '@/types/dashboard';
import { designTokens, spacing } from '@/theme';

type OfficeDashboardHeroProps = {
  snapshot: DashboardSnapshot;
  displayName: string;
  roleKey: RoleKey;
  onPrimaryAction?: (action: DashboardQuickAction) => void;
};

export function OfficeDashboardHero({
  snapshot,
  displayName,
  roleKey,
  onPrimaryAction,
}: OfficeDashboardHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: colors.cyan,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: { ...typography.h2, color: text.primary },
  meta: { ...typography.caption, color: text.muted },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,149,0,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preparedHint: { ...typography.caption, color: text.muted },
}),
    [colors, text.muted, text.primary, typography, gradients],
  );


  const isLive = isOfficeDashboardLiveReady();

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>OFFICE</Text>
          <Text style={styles.title}>
            {snapshot.greeting}, {displayName}
          </Text>
          <Text style={styles.meta}>{snapshot.heroSubtitle}</Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🏢</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isLive ? (
          <PremiumBadge label="Live Mandant" variant="green" dot />
        ) : (
          <PremiumBadge label="Demo / preparedOnly" variant="muted" />
        )}
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
      </View>
      <AdaptiveKpiGrid
        items={dashboardKpisToGridItems(
          snapshot.kpis.map((kpi) => ({
            ...kpi,
            value: String(kpi.value),
          })),
        )}
      />
      {!isLive ? <Text style={styles.preparedHint}>{OFFICE_DASHBOARD_PREPARED_MESSAGE}</Text> : null}
      <PremiumButton
        title={`${snapshot.primaryAction.icon} ${snapshot.primaryAction.label}`}
        onPress={() => onPrimaryAction?.(snapshot.primaryAction)}
        fullWidth
      />
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

