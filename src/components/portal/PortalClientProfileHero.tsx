import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { PORTAL_CLIENT_LABEL } from '@/lib/portal/portalDisplayLabels';
import {
  isPortalProfileLiveReady,
  PORTAL_PROFILE_PREPARED_MESSAGE,
} from '@/lib/portal/portalModuleConfig';
import { buildClientPortalProfileKpis } from '@/lib/portal/portalProfileStats';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { getServiceMode } from '@/lib/services/mode';

import type { PortalClientProfile } from '@/types/portal/client';
import { designTokens, spacing } from '@/theme';
import { portalPremium } from '@/design/tokens/portalPremium';

type PortalClientProfileHeroProps = {
  profile: PortalClientProfile;
};

export function PortalClientProfileHero({ profile }: PortalClientProfileHeroProps) {
  const { colors, typography, mode } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: colors.primary,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: heroText.title,
  meta: heroText.meta,
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: portalPremium.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: portalPremium.borderStrong,
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  preparedHint: heroText.meta,
}),
    [colors, typography, heroText.meta, heroText.title],
  );


  const kpis = buildClientPortalProfileKpis(profile, mode);
  const profileDataLive = isPortalProfileLiveReady();
  const authLive = getServiceMode() === 'supabase';

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{profile.displayName}</Text>
          <Text style={styles.meta}>Ihre persönlichen Stammdaten und Versorgungsangaben</Text>
        </View>
        <View style={styles.iconBadge}>
          <Ionicons name="person-circle-outline" color={portalPremium.accent.blue} size={27} />
        </View>
      </View>
      <View style={styles.badges}>
        {profile.careLevel ? (
          <PremiumBadge label={formatCareLevel(profile.careLevel)} variant="green" dot />
        ) : null}
        <PremiumBadge label={PORTAL_CLIENT_LABEL} variant="cyan" />
        {profileDataLive ? (
          <PremiumBadge label="Cloud Live" variant="green" dot />
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
      {!profileDataLive && !authLive ? (
        <Text style={styles.preparedHint}>{PORTAL_PROFILE_PREPARED_MESSAGE}</Text>
      ) : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;
