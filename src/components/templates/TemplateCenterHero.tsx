import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import type { TemplateDashboardStats } from '@/types/templates';
import { designTokens, spacing } from '@/theme';

type TemplateCenterHeroProps = {
  stats: TemplateDashboardStats;
  roleKey: RoleKey;
};

export function TemplateCenterHero({ stats, roleKey }: TemplateCenterHeroProps) {
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
    backgroundColor: colors.bgElevated,
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


  const totalTemplates = stats.systemCount + stats.tenantCount;

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>BUSINESS</Text>
          <Text style={styles.title}>Vorlagenzentrum</Text>
          <Text style={styles.meta}>
            {totalTemplates} Vorlagen · {stats.modulesWithTemplates} Module · Paket F
          </Text>
          <Text style={styles.subtitle}>
            System- und Mandantenvorlagen, Kataloge und Textbausteine zentral verwalten.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>📝</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard
          label="Systemvorlagen"
          value={String(stats.systemCount)}
          icon="🏛️"
          accentColor={colors.cyan}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Mandantenvorlagen"
          value={String(stats.tenantCount)}
          icon="🏢"
          accentColor={colors.success}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Aktiv"
          value={String(stats.activeCount)}
          icon="✅"
          accentColor={colors.success}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Archiviert"
          value={String(stats.archivedCount)}
          icon="📦"
          accentColor={colors.amber}
          style={styles.kpiItem}
        />
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

