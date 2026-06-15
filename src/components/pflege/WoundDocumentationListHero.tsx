import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import {
  DesktopListViewToggle,
  PremiumBadge,
  PremiumKpiCard,
  PremiumListHeroFrame,
  type DesktopListViewMode,
} from '@/components/ui';
import { buildWoundDocumentationListKpis } from '@/lib/pflege/woundDocumentationListStats';
import {
  isWoundBodyMapReady,
  WOUND_DOCUMENTATION_PREPARED_MESSAGE,
} from '@/lib/pflege/pflegeModuleConfig';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import type { WoundDocumentation } from '@/types/modules/pflege';
import { designTokens, spacing } from '@/theme';

type WoundDocumentationListHeroProps = {
  items: WoundDocumentation[];
  roleKey: RoleKey;
  isReadOnly: boolean;
  viewMode?: DesktopListViewMode;
  onViewModeChange?: (mode: DesktopListViewMode) => void;
  showViewToggle?: boolean;
};

export function WoundDocumentationListHero({
  items,
  roleKey,
  isReadOnly,
  viewMode = 'table',
  onViewModeChange,
  showViewToggle = false,
}: WoundDocumentationListHeroProps) {
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
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,77,106,0.35)',
  },
  iconText: {
    fontSize: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
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


  const kpis = buildWoundDocumentationListKpis(items, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>PFLEGE · WUNDDOKUMENTATION</Text>
          <Text style={styles.title}>Wundmanagement</Text>
          <Text style={styles.meta}>
            {items.length} Wundfälle
            {isReadOnly ? ' · Lesemodus' : ''}
          </Text>
          <Text style={styles.subtitle}>
            Lokalisation, Heilungsverlauf — demo-funktional.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🩹</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        {!isWoundBodyMapReady() ? (
          <PremiumBadge label="BodyMap extern" variant="muted" />
        ) : null}
      </View>
      {showViewToggle && onViewModeChange ? (
        <DesktopListViewToggle value={viewMode} onChange={onViewModeChange} />
      ) : null}
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
    </PremiumListHeroFrame>
  );
}

export { WOUND_DOCUMENTATION_PREPARED_MESSAGE };

const iconSize = designTokens.hero.iconBadgeSize;

