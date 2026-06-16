import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import {
  ACCESS_MANAGEMENT_PREPARED_MESSAGE,
  isAccessManagementLiveReady,
} from '@/lib/access/accessModuleConfig';
import { buildAccessDashboardKpis } from '@/lib/access/accessListStats';
import type { AccessDashboardStats } from '@/lib/auth/permissionService';
import { isDemoMode } from '@/lib/supabase/config';
import { designTokens, spacing } from '@/theme';

type AccessManagementDashboardHeroProps = {
  stats: AccessDashboardStats;
};

export function AccessManagementDashboardHero({ stats }: AccessManagementDashboardHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
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
    borderColor: 'rgba(98,243,255,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  preparedHint: { ...typography.caption, color: colors.textMuted },
}),
    [colors, typography, gradients],
  );


  const kpis = buildAccessDashboardKpis(stats, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>OFFICE · VERWALTUNG</Text>
          <Text style={styles.title}>Zugänge & Benutzer</Text>
          <Text style={styles.meta}>
            Interne Benutzer, Mitarbeiterportale und Klient:innen-Codes zentral verwalten
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🔐</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label="Mandanten-Admin" variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        {!isAccessManagementLiveReady() ? (
          <PremiumBadge statusKind="preparedOnly" />
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
      {!isAccessManagementLiveReady() ? (
        <Text style={styles.preparedHint}>{ACCESS_MANAGEMENT_PREPARED_MESSAGE}</Text>
      ) : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

