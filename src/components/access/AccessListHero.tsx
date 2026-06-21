import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import {
  ACCESS_MANAGEMENT_PREPARED_MESSAGE,
  CLIENT_PORTAL_ACCESS_PREPARED_MESSAGE,
  RELATIVE_PORTAL_ACCESS_PREPARED_MESSAGE,
  isAccessManagementLiveReady,
  isClientPortalAccessLiveReady,
  isRelativePortalAccessLiveReady,
} from '@/lib/access/accessModuleConfig';
import { useTenantDisplayName } from '@/hooks/useTenantDisplayName';
import {
  buildAccessListKpis,
  getAccessListHeroMeta,
  type AccessListHeroVariant,
} from '@/lib/access/accessListStats';

import { designTokens, spacing } from '@/theme';

type AccessListHeroProps = {
  variant: AccessListHeroVariant;
  itemCount: number;
  liveReady?: boolean;
};

function resolveVariantLiveReady(variant: AccessListHeroVariant, liveReady?: boolean): boolean {
  if (liveReady !== undefined) return liveReady;
  if (variant === 'client-portal') return isClientPortalAccessLiveReady();
  if (variant === 'relative-portal') return isRelativePortalAccessLiveReady();
  return isAccessManagementLiveReady();
}

export function AccessListHero({ variant, itemCount, liveReady }: AccessListHeroProps) {
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


  const tenantName = useTenantDisplayName();
  const isLive = resolveVariantLiveReady(variant, liveReady);
  const meta = getAccessListHeroMeta(variant);
  const kpis = buildAccessListKpis(variant, itemCount, mode, {
    tenantName,
    isLive,
  });
  const preparedMessage =
    variant === 'client-portal'
      ? CLIENT_PORTAL_ACCESS_PREPARED_MESSAGE
      : variant === 'relative-portal'
        ? RELATIVE_PORTAL_ACCESS_PREPARED_MESSAGE
        : ACCESS_MANAGEMENT_PREPARED_MESSAGE;

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
        {!isLive ? <PremiumBadge label="preparedOnly" variant="muted" /> : (
          <PremiumBadge label="Cloud Live" variant="green" dot />
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
      {!isLive ? <Text style={styles.preparedHint}>{preparedMessage}</Text> : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

