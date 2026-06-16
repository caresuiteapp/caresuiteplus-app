import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import {
  ACCESS_MANAGEMENT_PREPARED_MESSAGE,
  isAccessManagementLiveReady,
} from '@/lib/access/accessModuleConfig';
import {
  buildAccessListKpis,
  getAccessListHeroMeta,
  type AccessListHeroVariant,
} from '@/lib/access/accessListStats';
import { isDemoMode } from '@/lib/supabase/config';
import { designTokens, spacing } from '@/theme';

type AccessListHeroProps = {
  variant: AccessListHeroVariant;
  itemCount: number;
};

export function AccessListHero({ variant, itemCount }: AccessListHeroProps) {
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
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  preparedHint: { ...typography.caption, color: colors.textMuted },
}),
    [colors, typography, gradients],
  );


  const meta = getAccessListHeroMeta(variant);
  const kpis = buildAccessListKpis(variant, itemCount, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>{meta.eyebrow}</Text>
          <Text style={styles.title}>{meta.title}</Text>
          <Text style={styles.meta}>{meta.meta}</Text>
        </View>
        <View style={[styles.iconBadge, { borderColor: `${meta.accentColor}55` }]}>
          <Text style={styles.iconText}>{meta.icon}</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={`${itemCount} Einträge`} variant="orange" dot />
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

